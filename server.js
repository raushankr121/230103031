const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const AUTH_URL =
  "http://4.224.186.213/evaluation-service/auth";

const API_URL =
  "http://4.224.186.213/evaluation-service/notifications";

// ---------------- PRIORITY LOGIC ----------------

const typeWeight = {
  Placement: 30,
  Result: 20,
  Event: 10,
};

function getKeywordWeight(message = "") {
  const msg = message.toLowerCase();

  if (msg.includes("hiring")) return 25;
  if (msg.includes("mid-sem")) return 20;
  if (msg.includes("project-review")) return 15;
  if (msg.includes("external")) return 12;
  if (msg.includes("farewell")) return 8;

  return 5;
}

function getRecencyWeight(timestamp) {
  const now = new Date();
  const notificationTime = new Date(timestamp);

  const diffMinutes =
    (now - notificationTime) / (1000 * 60);

  if (diffMinutes <= 5) return 30;
  if (diffMinutes <= 30) return 20;
  if (diffMinutes <= 60) return 10;

  return 5;
}

function calculatePriority(notification) {
  const typeScore =
    typeWeight[notification.Type] || 0;

  const keywordScore =
    getKeywordWeight(notification.Message);

  const recencyScore =
    getRecencyWeight(notification.Timestamp);

  return (
    typeScore +
    keywordScore +
    recencyScore
  );
}

// ---------------- LOGGER ----------------

app.use((req, res, next) => {
  console.log(
    `${req.method} ${req.url} ${new Date().toISOString()}`
  );
  next();
});

// ---------------- HOME ----------------

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Server running successfully",
  });
});

// ---------------- GET TOKEN ----------------

async function getAccessToken() {
  try {
    const authResponse = await axios.post(
      AUTH_URL,
      {
        email:
          "raushan.230103031@iiitbh.ac.in",

        name:
          "raushan kumar",

        rollNo:
          "230103031",

        accessCode:
          "NbQTbT",

        clientID:
          "51a781a9-4261-4b98-81dc-22b5efcc4690",

        clientSecret:
          "udMJSxudHHwwcCKb",
      },
      {
        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );

    console.log("AUTH SUCCESS");

    const token =
      authResponse.data.access_token;

    if (!token) {
      throw new Error(
        "Token missing"
      );
    }

    return token.trim();

  } catch (error) {

    console.log(
      "AUTH ERROR:",
      error.response?.status
    );

    console.log(
      error.response?.data ||
      error.message
    );

    throw error;
  }
}

// ---------------- FETCH NOTIFICATIONS ----------------

app.get(
  "/evaluation-service/notifications",
  async (req, res) => {

    try {

      // STEP 1: GET TOKEN
      const token =
        await getAccessToken();

      console.log(
        "TOKEN RECEIVED"
      );

      // STEP 2: FETCH DATA
      const response =
        await axios.get(
          API_URL,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      console.log(
        "NOTIFICATIONS FETCHED"
      );

      const notifications =
        response.data.notifications || [];

      // STEP 3: PRIORITY
      const prioritized =
        notifications.map(
          (notification) => ({
            ...notification,

            priorityScore:
              calculatePriority(
                notification
              ),
          })
        );

      prioritized.sort(
        (a, b) =>
          b.priorityScore -
          a.priorityScore
      );

      const topNotifications =
        prioritized.slice(0, 10);

      // STEP 4: RESPONSE
      res.status(200).json({
        success: true,

        totalNotifications:
          notifications.length,

        topCount:
          topNotifications.length,

        notifications:
          topNotifications,
      });

    } catch (error) {

      console.log(
        "FETCH ERROR:",
        error.response?.status
      );

      console.log(
        error.response?.data ||
        error.message
      );

      res.status(
        error.response?.status || 500
      ).json({
        success: false,

        message:
          "Error fetching notifications",

        error:
          error.response?.data ||
          error.message,
      });
    }
  }
);

// ---------------- SERVER ----------------

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});