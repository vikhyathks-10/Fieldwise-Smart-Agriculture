
import api from './services/api.js'

// MongoDB document details
const FARM_ID = 206

const OBSERVATION_ID = '6af40d9354769a5f44b53ad1'


// =====================================================
// CREATE - Insert a weather observation into MongoDB
// =====================================================

export async function testMongoCreate() {
    try {
        const response = await api.post(
            '/farmer/weather-observations',
            {
                farmId: FARM_ID,
                temperature: 31.5,
                humidity: 72,
                rainfall: 4.5,
                windSpeed: 12,
                condition: 'Cloudy',

                sensorReadings: {
                    soilMoisture: 38.5,
                    lightIntensity: 750,
                    soilTemperature: 27.2
                },

                recordedAt: new Date().toISOString()
            }
        )

        console.log('CREATE successful!')
        console.log('HTTP Status:', response.status)
        console.log('Created Observation:', response.data)

        return response.data

    } catch (error) {
        console.error('CREATE failed!')
        console.error('HTTP Status:', error.response?.status)
        console.error('Error:', error.response?.data || error.message)

        return null
    }
}


// =====================================================
// READ - Retrieve all weather observations for a farm
// =====================================================

export async function testMongoRead() {
    try {
        const response = await api.get(
            `/farmer/weather-observations/${FARM_ID}`
        )

        console.log('READ successful!')
        console.log('HTTP Status:', response.status)
        console.log('Total Observations:', response.data.count)
        console.log('Observations:', response.data.observations)

        return response.data

    } catch (error) {
        console.error('READ failed!')
        console.error('HTTP Status:', error.response?.status)
        console.error('Error:', error.response?.data || error.message)

        return null
    }
}


// =====================================================
// UPDATE - Modify an existing weather observation
// =====================================================

export async function testMongoUpdate() {
    try {
        const response = await api.put(
            `/farmer/weather-observations/${OBSERVATION_ID}`,
            {
                temperature: 29.8,
                humidity: 68,
                rainfall: 6.2,
                condition: 'Light Rain',

                sensorReadings: {
                    soilMoisture: 42.5,
                    lightIntensity: 620,
                    soilTemperature: 26.4
                }
            }
        )

        console.log('UPDATE successful!')
        console.log('HTTP Status:', response.status)
        console.log('Updated Observation:', response.data)

        return response.data

    } catch (error) {
        console.error('UPDATE failed!')
        console.error('HTTP Status:', error.response?.status)
        console.error('Error:', error.response?.data || error.message)

        return null
    }
}


// =====================================================
// DELETE - Delete an existing weather observation
// =====================================================

export async function testMongoDelete() {
    try {
        const confirmation = window.confirm(
            'Are you sure you want to delete this MongoDB weather observation?'
        )

        if (!confirmation) {
            console.log('DELETE operation cancelled.')
            return null
        }

        const response = await api.delete(
            `/farmer/weather-observations/${OBSERVATION_ID}`
        )

        console.log('DELETE successful!')
        console.log('HTTP Status:', response.status)
        console.log('Deleted Observation:', response.data)

        return response.data

    } catch (error) {
        console.error('DELETE failed!')
        console.error('HTTP Status:', error.response?.status)
        console.error('Error:', error.response?.data || error.message)

        return null
    }
}
