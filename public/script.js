// script.js

// ===========================
// CONFIGURE THESE VALUES:
// Replace with your own Firebase project config:

// Replace with your generated VAPID public key
const VAPID_PUBLIC_KEY = "BJuKex5x3xgK2QK3C3wu0XatbN5plu_WTtapN59rOkzn5N8a5WxWo5RMc6vOjNmt-EztJ4Bizk8c-RLhQpidJg0";
// ===========================

firebase.initializeApp(window._FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentChatUserEmail = null;
let currentChatUnsub = null;
let notificationsEnabled = false;

// UI Elements
const appTitle = document.getElementById('app-title');
const backBtn = document.getElementById('back-btn');
const settingsBtn = document.getElementById('settings-btn');

const authView = document.getElementById('auth-view');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');

const contactsView = document.getElementById('contacts-view');
const searchEmail = document.getElementById('searchEmail');
const searchBtn = document.getElementById('searchBtn');
const contactsList = document.getElementById('contacts-list');

const chatView = document.getElementById('chat-view');
const chatTitle = document.getElementById('chat-title');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

const settingsView = document.getElementById('settings-view');
const toggleNotificationsBtn = document.getElementById('toggleNotificationsBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Navigation
function showView(view) {
  authView.style.display = 'none';
  contactsView.style.display = 'none';
  chatView.style.display = 'none';
  settingsView.style.display = 'none';
  backBtn.style.display = 'none';
  settingsBtn.style.display = 'none';

  switch (view) {
    case 'auth':
      authView.style.display = 'flex';
      appTitle.textContent = 'Cari Chat';
      break;
    case 'contacts':
      contactsView.style.display = 'flex';
      appTitle.textContent = 'Contacts';
      settingsBtn.style.display = 'inline-block';
      break;
    case 'chat':
      chatView.style.display = 'flex';
      backBtn.style.display = 'inline-block';
      break;
    case 'settings':
      settingsView.style.display = 'flex';
      appTitle.textContent = 'Settings';
      backBtn.style.display = 'inline-block';
      break;
  }
}

backBtn.addEventListener('click', () => {
  showView('contacts');
});

settingsBtn.addEventListener('click', () => {
  showView('settings');
});

// Auth state changes
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    loadContacts();
    checkNotificationStatus();
    showView('contacts');
  } else {
    currentUser = null;
    showView('auth');
  }
});

// Authentication
loginBtn.addEventListener('click', async () => {
  try {
    await auth.signInWithEmailAndPassword(loginEmail.value, loginPassword.value);
  } catch (err) {
    alert(err.message);
  }
});

signupBtn.addEventListener('click', async () => {
  try {
    await auth.createUserWithEmailAndPassword(loginEmail.value, loginPassword.value);
    await db.collection('users').doc(loginEmail.value).set({ email: loginEmail.value });
  } catch (err) {
    alert(err.message);
  }
});

// Contacts
async function loadContacts() {
  const contactsSnapshot = await db.collection('users').get();
  contactsList.innerHTML = '';
  contactsSnapshot.forEach(doc => {
    const user = doc.data();
    if (user.email !== currentUser.email) {
      const contactItem = createContactItem(user.email);
      contactsList.appendChild(contactItem);
    }
  });
}

function createContactItem(email) {
  const div = document.createElement('div');
  div.className = 'contact-item';
  div.innerHTML = `
    <div class="avatar">${email[0].toUpperCase()}</div>
    <span class="email">${email}</span>
  `;
  div.addEventListener('click', () => startChatWith(email));
  return div;
}

searchBtn.addEventListener('click', async () => {
  const email = searchEmail.value.trim();
  if (!email) return;
  const userDoc = await db.collection('users').doc(email).get();
  contactsList.innerHTML = '';
  if (userDoc.exists && email !== currentUser.email) {
    const contactItem = createContactItem(userDoc.data().email);
    contactsList.appendChild(contactItem);
  } else {
    contactsList.innerHTML = '<div>No user found or it is your own email</div>';
  }
});

// Chat
async function startChatWith(otherUserEmail) {
  currentChatUserEmail = otherUserEmail;
  chatTitle.textContent = otherUserEmail;
  messagesDiv.innerHTML = '';
  showView('chat');

  const participants = [currentUser.email, otherUserEmail].sort();
  const chatId = participants.join('_');

  if (currentChatUnsub) currentChatUnsub();

  currentChatUnsub = db.collection('chats').doc(chatId).collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      messagesDiv.innerHTML = '';
      snapshot.forEach(doc => {
        const msg = doc.data();
        const div = document.createElement('div');
        div.className = `message ${msg.sender === currentUser.email ? 'own' : ''}`;
        div.innerHTML = `<span class="sender">${msg.sender === currentUser.email ? 'You' : msg.sender}:</span> ${msg.text}`;
        messagesDiv.appendChild(div);
      });
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}

sendBtn.addEventListener('click', async () => {
  const text = messageInput.value.trim();
  if (!text || !currentChatUserEmail) return;

  const participants = [currentUser.email, currentChatUserEmail].sort();
  const chatId = participants.join('_');

  await db.collection('chats').doc(chatId).collection('messages').add({
    sender: currentUser.email,
    text,
    timestamp: new Date()
  });

  messageInput.value = '';

  // Send push notification via server
  if (notificationsEnabled) {
      fetch('/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Message',
          body: `Message from ${currentUser.email}`
        })
      });
  }
});

// Settings

// Check if notifications are enabled or disabled
async function checkNotificationStatus() {
  if (Notification.permission === 'granted') {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    notificationsEnabled = !!subscription;
  } else {
    notificationsEnabled = false;
  }
  updateNotificationButton();
}

// Update the text of the toggle button based on notification status
function updateNotificationButton() {
  toggleNotificationsBtn.textContent = notificationsEnabled ? 'Disable Notifications' : 'Enable Notifications';
}

toggleNotificationsBtn.addEventListener('click', async () => {
  if (notificationsEnabled) {
    // Disable notifications
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      await fetch('/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
    }
    notificationsEnabled = false;
    alert('Notifications disabled!');
  } else {
    // Enable notifications
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Notification permission granted.');
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        console.log('Push subscription successful:', subscription);
        await fetch('/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription)
        });
        notificationsEnabled = true;
        alert('Notifications enabled!');
      } else {
        console.warn('Notification permission denied or dismissed.');
        alert('Notifications not granted');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      alert('Error enabling notifications. Check console for details.');
    }
  }
  updateNotificationButton();
});

logoutBtn.addEventListener('click', () => {
  auth.signOut();
});

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}