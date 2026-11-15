import { recordsService } from '../../business/services/recordsService.js'
import { toAppError } from '../../utils/errors.js'
import { insightsService } from '../../business/services/insightsService.js'
export const recordsController={
 health:(req,res,next)=>run(next,async()=>res.json(await recordsService.health())),
 list:(req,res,next)=>run(next,async()=>res.json(await recordsService.list(req.params.slug))),
 create:(req,res,next)=>run(next,async()=>res.status(201).json(await recordsService.create(req.params.slug,req.body))),
 update:(req,res,next)=>run(next,async()=>res.json(await recordsService.update(req.params.slug,req.params.id,req.body))),
 remove:(req,res,next)=>run(next,async()=>res.json(await recordsService.remove(req.params.slug,req.params.id))),
 dashboard:(req,res,next)=>run(next,async()=>res.json(await recordsService.dashboard())),
 farmerDetails:(req,res,next)=>run(next,async()=>res.json(await recordsService.farmerDetails(req.params.id))),
 farmsByFarmer:(req,res,next)=>run(next,async()=>res.json(await recordsService.farmsByFarmer(req.params.id))),
 totalFarmArea:(req,res,next)=>run(next,async()=>res.json(await recordsService.totalFarmArea(req.params.id))),
 databaseOperations:(req,res,next)=>run(next,async()=>res.json(await recordsService.databaseOperations())),
 executeDatabaseOperation:(req,res,next)=>run(next,async()=>res.json(await recordsService.runOperation(req.body))),
 farmerFarmSummary:(req,res,next)=>run(next,async()=>res.json(await recordsService.farmerFarmSummary())),
 registerCultivation:(req,res,next)=>run(next,async()=>res.status(201).json(await recordsService.registerCultivation(req.body))),
 auditRecords:(req,res,next)=>run(next,async()=>res.json(await recordsService.auditRecords())),
 advancedDashboard:(req,res,next)=>run(next,async()=>res.json(await insightsService.dashboard())),
 cropAdvisory:(req,res,next)=>run(next,async()=>res.json(await insightsService.cropAdvisory(req.params.farmId))),
 marketIntelligence:(req,res,next)=>run(next,async()=>res.json(await insightsService.markets(req.query))),
 alerts:(req,res,next)=>run(next,async()=>res.json(await insightsService.alerts())),
 report:(req,res,next)=>run(next,async()=>res.json(await insightsService.report(req.params.report,req.query))),
 farmerAudit:(req,res,next)=>run(next,async()=>res.json(await insightsService.audit(req.query))),
 operationsMetadata:(req,res,next)=>run(next,async()=>res.json(await recordsService.operationsMetadata()))
}
async function run(next,work){try{return await work()}catch(err){next(toAppError(err))}}
