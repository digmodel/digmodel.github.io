// config.js — enkel och stabil init (compat)
(function () {
  if (typeof firebase === "undefined") {
    console.error("❌ Firebase SDK saknas – se till att SDK-scriptet laddas före config.js.");
    return;
  }

  // Hårdkodad konfig (samma som du redan använder)
  const firebaseConfig = {
    apiKey: "AIzaSyC3_O3FBoJME-5JiiYHz-8bMmjHY8R83q4",
    authDomain: "digmodel-app-463217.firebaseapp.com",
    projectId: "digmodel-app-463217",
    storageBucket: "digmodel-app-463217.firebasestorage.app",
    messagingSenderId: "784968031589",
    appId: "1:784968031589:web:b1142c64043f72e51bd58c",
    measurementId: "G-6BTZ999W4Z",
  };

  // Initiera bara om ingen app finns
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  // (valfritt) exponera helpers globalt
  window.auth = firebase.auth();
  window.db = firebase.firestore();
  window.functions = firebase.functions();

  // Signala att Firebase är redo om din app väntar på det
  document.dispatchEvent(new Event("firebase-ready"));
})();
