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
  
  // Elements
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const userInfo = document.getElementById('user-info');
  const userEmailSpan = document.getElementById('userEmail');
  const logoutBtn = document.getElementById('logoutBtn');
  const loginForm = document.getElementById('login-form');
  
  const searchSection = document.getElementById('search-section');
  const searchEmail = document.getElementById('searchEmail');
  const searchBtn = document.getElementById('searchBtn');
  const searchResults = document.getElementById('searchResults');
  
  const chatSection = document.getElementById('chat-section');
  const chatWithTitle = document.getElementById('chatWith');
  const messagesDiv = document.getElementById('messages');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  
  const notificationSection = document.getElementById('notification-section');
  const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
  
  // Auth state changes
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      userEmailSpan.textContent = user.email;
      loginForm.style.display = 'none';
      userInfo.style.display = 'inline-block';
      searchSection.style.display = 'block';
      notificationSection.style.display = 'block';
    } else {
      currentUser = null;
      loginForm.style.display = 'block';
      userInfo.style.display = 'none';
      searchSection.style.display = 'none';
      chatSection.style.display = 'none';
      notificationSection.style.display = 'none';
      if (currentChatUnsub) currentChatUnsub();
    }
  });
  
  // Login
  loginBtn.addEventListener('click', async () => {
    try {
      await auth.signInWithEmailAndPassword(loginEmail.value, loginPassword.value);
    } catch (err) {
      alert(err.message);
    }
  });
  
  // Signup
  signupBtn.addEventListener('click', async () => {
    try {
      await auth.createUserWithEmailAndPassword(loginEmail.value, loginPassword.value);
      // Create user doc
      await db.collection('users').doc(loginEmail.value).set({email: loginEmail.value});
    } catch (err) {
      alert(err.message);
    }
  });
  
  // Logout
  logoutBtn.addEventListener('click', () => {
    auth.signOut();
  });
  
  // Search for users
  searchBtn.addEventListener('click', async () => {
    const email = searchEmail.value.trim();
    if (!email) return;
    const userDoc = await db.collection('users').doc(email).get();
    searchResults.innerHTML = '';
    if (userDoc.exists && email !== currentUser.email) {
      const div = document.createElement('div');
      div.textContent = userDoc.data().email;
      div.addEventListener('click', () => startChatWith(userDoc.data().email));
      searchResults.appendChild(div);
    } else {
      searchResults.innerHTML = '<div>No user found or it is your own email</div>';
    }
  });
  
  // Start chat
  async function startChatWith(otherUserEmail) {
    currentChatUserEmail = otherUserEmail;
    chatSection.style.display = 'block';
    chatWithTitle.textContent = `Chat with: ${otherUserEmail}`;
    messagesDiv.innerHTML = '';
  
    // Sort emails to create a consistent chatId
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
          div.className = 'message';
          div.innerHTML = `<span class="sender">${msg.sender === currentUser.email ? 'You' : msg.sender}:</span> ${msg.text}`;
          messagesDiv.appendChild(div);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      });
  }
  
  // Send message
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
    fetch('/send-notification', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        title: 'New Message',
        body: `Message from ${currentUser.email}`
      })
    });
  });
  
  // Enable Notifications
  enableNotificationsBtn.addEventListener('click', async () => {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
  
      await fetch('/subscribe', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(subscription)
      });
  
      alert('Notifications enabled!');
    } else {
      alert('Notifications not granted');
    }
  });
  
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
      
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
      
    for (let i=0; i<rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
  