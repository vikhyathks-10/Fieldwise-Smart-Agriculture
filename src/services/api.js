
import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
    timeout: 12000,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
})

// Response interceptor for handling authentication errors
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            console.error(
                'Authentication failed. Please log in using the correct account.'
            )
        }

        return Promise.reject(error)
    }
)

// Extract API error messages
export const getError = error =>
    error?.response?.data?.error ||
    'Could not reach the database service. Check the API and database connections.'

export default api
