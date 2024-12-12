// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const webpush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
  'mailto:example@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage for subscriptions
// In production, store in a DB (like Firestore).
let subscriptions = [];

app.post('/subscribe', (req, res) => {
  const subscription = req.body;
  // Avoid duplicates
  const exists = subscriptions.findIndex(sub => sub.endpoint === subscription.endpoint);
  if (exists === -1) {
    subscriptions.push(subscription);
  }
  res.status(201).json({});
});

app.post('/send-notification', (req, res) => {
  const { title, body } = req.body;
  const payload = JSON.stringify({ title, body });

  const promises = subscriptions.map(sub => 
    webpush.sendNotification(sub, payload).catch(err => console.error(err))
  );
  
  Promise.all(promises)
    .then(() => res.sendStatus(200))
    .catch(() => res.sendStatus(500));
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
