
import mongoose from 'mongoose'

const weatherObservationSchema = new mongoose.Schema(
    {
        farmId: {
            type: Number,
            required: true,
            index: true
        },

        temperature: {
            type: Number,
            required: true
        },

        humidity: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },

        rainfall: {
            type: Number,
            default: 0,
            min: 0
        },

        windSpeed: {
            type: Number,
            default: 0,
            min: 0
        },

        condition: {
            type: String,
            required: true,
            trim: true
        },

        sensorReadings: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        recordedAt: {
            type: Date,
            default: Date.now,
            index: true
        }
    },
    {
        timestamps: true,
        collection: 'weather_observations'
    }
)

weatherObservationSchema.index({
    farmId: 1,
    recordedAt: -1
})

const WeatherObservation = mongoose.model(
    'WeatherObservation',
    weatherObservationSchema
)

export default WeatherObservation
