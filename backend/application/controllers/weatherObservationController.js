
import { weatherObservationService } from '../../business/services/weatherObservationService.js'
import { toAppError } from '../../utils/errors.js'

async function run(next, work) {
    try {
        return await work()
    } catch (error) {
        next(toAppError(error))
    }
}

export const weatherObservationController = {

    // CREATE
    create(req, res, next) {
        return run(next, async () => {
            const result = await weatherObservationService.create(
                req.user,
                req.body
            )

            res.status(201).json({
                message: 'Weather observation created successfully.',
                observation: result
            })
        })
    },

    // READ: All observations for a farm
    listByFarm(req, res, next) {
        return run(next, async () => {
            const result = await weatherObservationService.listByFarm(
                req.user,
                req.params.farmId
            )

            res.json({
                count: result.length,
                observations: result
            })
        })
    },

    // READ: One observation
    getById(req, res, next) {
        return run(next, async () => {
            const result = await weatherObservationService.getById(
                req.user,
                req.params.id
            )

            res.json({ observation: result })
        })
    },

    // UPDATE
    update(req, res, next) {
        return run(next, async () => {
            const result = await weatherObservationService.update(
                req.user,
                req.params.id,
                req.body
            )

            res.json({
                message: 'Weather observation updated successfully.',
                observation: result
            })
        })
    },

    // DELETE
    remove(req, res, next) {
        return run(next, async () => {
            const result = await weatherObservationService.remove(
                req.user,
                req.params.id
            )

            res.json({
                message: 'Weather observation deleted successfully.',
                deletedObservation: result
            })
        })
    }
}
