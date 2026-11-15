import { tables } from '../../../shared/schema.js'
import { recordRepository } from '../../data-access/repositories/recordRepository.js'
import { agricultureRepository } from '../../data-access/repositories/agricultureRepository.js'
import { validateId, validateRecord } from '../validators/records.js'
import { AppError } from '../../utils/errors.js'
import { insightsRepository } from '../../data-access/repositories/insightsRepository.js'
const metadata = slug => { const item=tables[slug]; if(!item) throw new AppError('Unknown resource.',404); return item }
export const recordsService={
 health(){return agricultureRepository.health()},
 list(slug,executor){return recordRepository.list(metadata(slug),executor)},
 async create(slug,body,executor){const meta=metadata(slug);const data=validateRecord(meta,body);await recordRepository.validateReferences(meta,data,executor);return recordRepository.insert(meta,data,executor)},
 async update(slug,id,body,executor){const meta=metadata(slug);validateId(id);const data=validateRecord(meta,body,{update:true});await recordRepository.validateReferences(meta,data,executor);const result=await recordRepository.update(meta,id,data,executor);if(!result.affectedRows)throw new AppError('Record not found.',404);return {updated:true,...result}},
 async remove(slug,id,executor){const meta=metadata(slug);validateId(id);const result=await recordRepository.remove(meta,id,executor);if(!result.affectedRows)throw new AppError('Record not found.',404);return {deleted:true,...result}},
 async runOperation({operation,slug,id,data}){
  metadata(slug)
  if(operation==='select')return {operation,...await recordRepository.listWithExecution(metadata(slug))}
  if(operation==='insert')return {operation,...await this.create(slug,data)}
  if(operation==='update')return {operation,...await this.update(slug,id,data)}
  if(operation==='delete')return {operation,...await this.remove(slug,id)}
  throw new AppError('Unsupported predefined database operation.',400)
 },
 async registerCultivation(body,executor){const meta=metadata('cultivation');const data=validateRecord(meta,body);return recordRepository.registerCultivation(data,executor)},
 dashboard(){return agricultureRepository.dashboard()},
 async farmerDetails(id){return agricultureRepository.farmerDetails(validateId(id))},
 async farmsByFarmer(id){return agricultureRepository.farmsByFarmer(validateId(id))},
 async totalFarmArea(id){return agricultureRepository.totalFarmArea(validateId(id))},
 databaseOperations(){return agricultureRepository.databaseOperations()},
 farmerFarmSummary(){return agricultureRepository.farmerFarmSummary()},
 auditRecords(){return agricultureRepository.auditRecords()},
 operationsMetadata(){return insightsRepository.operationsMetadata()}
}
