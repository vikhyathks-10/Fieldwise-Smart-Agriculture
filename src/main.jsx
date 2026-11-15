
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'
import { AuthProvider } from './auth/AuthProvider.jsx'

import {
    testMongoCreate,
    testMongoRead,
    testMongoUpdate,
    testMongoDelete
} from './testMongoDB.js'

import './styles.css'
import './presentation.css'

// Temporary MongoDB CRUD testing functions
window.testMongoCreate = testMongoCreate
window.testMongoRead = testMongoRead
window.testMongoUpdate = testMongoUpdate
window.testMongoDelete = testMongoDelete

// Render the Fieldwise application
createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <App />
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
)
