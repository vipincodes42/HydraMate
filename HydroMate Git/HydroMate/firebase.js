import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyBdIngmvvG0Tsr32qMKW5TLiozUWYbX8UI",
    authDomain: "hydramate-ca0c1.firebaseapp.com",
    databaseURL: "https://hydramate-ca0c1-default-rtdb.firebaseio.com",
    projectId: "hydramate-ca0c1",
    storageBucket: "hydramate-ca0c1.firebasestorage.app",
    messagingSenderId: "146361850572",
    appId: "1:146361850572:web:acc2a5184c43098646c069"
};

const app = initializeApp(firebaseConfig);
export const db   = getDatabase(app);
export const auth = getAuth(app);