
import mongoose from 'mongoose'
import WeatherObservation from '../models/WeatherObservation.js'

export const weatherObservationRepository = {

    // CREATE
    async create(data) {
        const observation = await WeatherObservation.create(data)
        return observation.toObject()
    },

    // READ: All observations for a farm
    async findByFarmId(farmId) {
        return WeatherObservation.find({
            farmId: Number(farmId)
        })
            .sort({ recordedAt: -1 })
            .lean()
    },

    // READ: One observation by MongoDB ID
    async findById(id) {
        if (!mongoose.isValidObjectId(id)) return null

        return WeatherObservation.findById(id).lean()
    },

    // READ: One observation belonging to a farm
    async findByIdAndFarmId(id, farmId) {
        if (!mongoose.isValidObjectId(id)) return null

        return WeatherObservation.findOne({
            _id: id,
            farmId: Number(farmId)
        }).lean()
    },

    // UPDATE
    async update(id, farmId, data) {
        if (!mongoose.isValidObjectId(id)) return null

        return WeatherObservation.findOneAndUpdate(
            {
                _id: id,
                farmId: Number(farmId)
            },
            { $set: data },
            {
                new: true,
                runValidators: true
            }
        ).lean()
    },

    // DELETE
    async remove(id, farmId) {
        if (!mongoose.isValidObjectId(id)) return null

        return WeatherObservation.findOneAndDelete({
            _id: id,
            farmId: Number(farmId)
        }).lean()
    }
}
