
import mongoose from 'mongoose'

import { weatherObservationRepository } from '../../data-access/repositories/weatherObservationRepository.js'
import { farmerPortalRepository } from '../../data-access/repositories/farmerPortalRepository.js'
import { AppError } from '../../utils/errors.js'

function requireFarmer(user) {
    if (
        user?.type !== 'farmer' ||
        !Number.isInteger(Number(user?.farmerId)) ||
        Number(user.farmerId) <= 0
    ) {
        throw new AppError('Farmer access required.', 403)
    }
}

function validateFarmId(value) {
    const id = Number(value)

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new AppError('Farm ID must be a positive integer.', 400)
    }

    return id
}

function validateObservationId(id) {
    if (!mongoose.isValidObjectId(id)) {
        throw new AppError('Invalid weather observation ID.', 400)
    }

    return id
}

function validateObservation(body, partial = false) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new AppError('Invalid weather observation data.', 400)
    }

    const data = {}

    const fields = ['temperature', 'humidity', 'rainfall', 'windSpeed']

    for (const field of fields) {
        if (body[field] === undefined) {
            if (!partial && ['temperature', 'humidity'].includes(field)) {
                throw new AppError(`${field} is required.`, 400)
            }
            continue
        }

        const value = body[field]

        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new AppError(`${field} must be a valid number.`, 400)
        }

        if (field === 'humidity' && (value < 0 || value > 100)) {
            throw new AppError('Humidity must be between 0 and 100.', 400)
        }

        if (['rainfall', 'windSpeed'].includes(field) && value < 0) {
            throw new AppError(`${field} cannot be negative.`, 400)
        }

        data[field] = value
    }

    if (body.condition !== undefined) {
        if (
            typeof body.condition !== 'string' ||
            !body.condition.trim()
        ) {
            throw new AppError('Condition must be a non-empty string.', 400)
        }

        data.condition = body.condition.trim()
    } else if (!partial) {
        throw new AppError('Weather condition is required.', 400)
    }

    if (body.sensorReadings !== undefined) {
        if (
            body.sensorReadings === null ||
            typeof body.sensorReadings !== 'object' ||
            Array.isArray(body.sensorReadings)
        ) {
            throw new AppError('Sensor readings must be an object.', 400)
        }

        data.sensorReadings = body.sensorReadings
    }

    if (body.recordedAt !== undefined) {
        const date = new Date(body.recordedAt)

        if (Number.isNaN(date.getTime())) {
            throw new AppError('Invalid observation date.', 400)
        }

        data.recordedAt = date
    }

    return data
}

async function verifyFarmOwnership(user, farmId) {
    try {
        await farmerPortalRepository.assertFarmerFarm(user, farmId, null)
    } catch (error) {
        if (error.code === 'OWNERSHIP') {
            throw new AppError(
                'Selected farm does not belong to this account.',
                403
            )
        }

        throw error
    }
}

export const weatherObservationService = {

    // CREATE
    async create(user, body) {
        requireFarmer(user)

        const farmId = validateFarmId(body?.farmId)

        await verifyFarmOwnership(user, farmId)

        const data = validateObservation(body)

        return weatherObservationRepository.create({
            ...data,
            farmId
        })
    },

    // READ: All observations for a farm
    async listByFarm(user, farmId) {
        requireFarmer(user)

        const id = validateFarmId(farmId)

        await verifyFarmOwnership(user, id)

        return weatherObservationRepository.findByFarmId(id)
    },

    // READ: One observation
    async getById(user, observationId) {
        requireFarmer(user)

        const id = validateObservationId(observationId)

        const observation =
            await weatherObservationRepository.findById(id)

        if (!observation) {
            throw new AppError('Weather observation not found.', 404)
        }

        await verifyFarmOwnership(user, observation.farmId)

        return observation
    },

    // UPDATE
    async update(user, observationId, body) {
        requireFarmer(user)

        const id = validateObservationId(observationId)

        const existing =
            await weatherObservationRepository.findById(id)

        if (!existing) {
            throw new AppError('Weather observation not found.', 404)
        }

        await verifyFarmOwnership(user, existing.farmId)

        if (body?.farmId !== undefined) {
            const requestedFarmId = validateFarmId(body.farmId)

            if (requestedFarmId !== existing.farmId) {
                throw new AppError(
                    'Changing the farm of an observation is not allowed.',
                    400
                )
            }
        }

        const data = validateObservation(body, true)

        if (Object.keys(data).length === 0) {
            throw new AppError('No valid fields provided for update.', 400)
        }

        return weatherObservationRepository.update(
            id,
            existing.farmId,
            data
        )
    },

    // DELETE
    async remove(user, observationId) {
        requireFarmer(user)

        const id = validateObservationId(observationId)

        const existing =
            await weatherObservationRepository.findById(id)

        if (!existing) {
            throw new AppError('Weather observation not found.', 404)
        }

        await verifyFarmOwnership(user, existing.farmId)

        return weatherObservationRepository.remove(
            id,
            existing.farmId
        )
    }
}
