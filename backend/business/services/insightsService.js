import { insightsRepository } from '../../data-access/repositories/insightsRepository.js'
import { agricultureRepository } from '../../data-access/repositories/agricultureRepository.js'
import { AppError } from '../../utils/errors.js'
const positiveId=value=>{if(!/^\d+$/.test(String(value))||Number(value)<1)throw new AppError('ID must be a positive integer.',400);return Number(value)}
const dateValue=(v,name)=>{if(!v)return undefined;if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(`${v}T00:00:00Z`)))throw new AppError(`${name} must use YYYY-MM-DD.`,400);return v}
export const insightsService={
 dashboard(){return agricultureRepository.dashboard()},
 async cropAdvisory(farmId){
  const context=await insightsRepository.farmAdvisoryContext(positiveId(farmId))
  if(!context)throw new AppError('Farm not found.',404)
  const recommendations=context.history.map((crop,index)=>({ ...crop, rank:index+1, basis:'Prior recorded cultivation on this farm', estimatedYieldNote:crop.avg_yield_estimate===null?'No yield estimate recorded.':'Historical yield estimate only; it is not measured yield or a suitability guarantee.', fertilizers:context.fertilizers.filter(f=>f.Crop_ID===crop.Crop_ID) }))
  return {...context,recommendations,limitations:['Crop has no requirement fields in the database.','Recommendations are a historical farm-record ranking only; they are not a scientific suitability assessment.','Soil and weather measurements are shown for context and are not converted into unverified thresholds.','Fertilizers listed are past recorded usage only; no dosage recommendation is generated.','Advisories are linked to pests and diseases in the schema, not directly to a crop or farm.']}
 },
 markets(filters){return insightsRepository.marketIntelligence({cropId:filters.cropId?positiveId(filters.cropId):undefined,marketId:filters.marketId?positiveId(filters.marketId):undefined,startDate:dateValue(filters.startDate,'Start date'),endDate:dateValue(filters.endDate,'End date'),search:String(filters.search||'').trim().slice(0,100)})},
 async alerts(){
  const data=await insightsRepository.alertRecords(),alerts=[]
  for(const w of data.weather){if(w.age_days===null)alerts.push({category:'Weather',severity:'attention',title:`No stored weather for ${w.Village||w.District||`location ${w.Location_ID}`}`,description:'No weather record is available for this location.',date:null,related:w})
   else alerts.push({category:'Weather',severity:Number(w.age_days)>7?'attention':'info',title:Number(w.age_days)>7?'Stored weather record is outdated':'Stored weather observation',description:`Recorded ${w.age_days} day(s) ago. This is stored data, not a live forecast.`,date:w.Date,related:w})}
  for(const a of data.advisories)alerts.push({category:'Advisory',severity:Number(a.age_days)>30?'attention':'info',title:a.Title,description:`${a.pest_name?`Related to ${a.pest_name}. `:''}${a.Description||'No description stored.'}${Number(a.age_days)>30?' This advisory is over 30 days old.':''}`,date:a.Advisory_Date,related:a})
  for(const p of data.pests)alerts.push({category:'Pest & disease',severity:'info',title:p.Name,description:p.Symptoms||'No symptoms are stored.',date:null,related:p})
  for(const c of data.cultivation)alerts.push({category:'Cultivation',severity:'info',title:`${c.Crop_Name} · ${c.Farm_Name}`,description:`Status: ${c.Status||'not recorded'}. End date: ${c.End_Date||'not recorded'}.`,date:c.Start_Date,related:c})
  for(const u of data.fertilizerUsage)alerts.push({category:'Fertilizer usage',severity:'info',title:`${u.Fertilizer_Name} applied · ${u.Farm_Name}`,description:`${u.Quantity??'Quantity not recorded'}${u.Method?` by ${u.Method}`:''}; this is history only and no reminder interval exists in the schema.`,date:u.Usage_Date,related:u})
  for(const s of data.soil){if(s.Soil_Test_ID==null)alerts.push({category:'Soil testing',severity:'attention',title:`No soil test recorded · ${s.Farm_Name}`,description:'No soil test is linked to this farm in the stored records.',date:null,related:s});else if(Number(s.age_days)>365)alerts.push({category:'Soil testing',severity:'attention',title:`Soil record is over one year old · ${s.Farm_Name}`,description:'This age marker is informational; it is not a recommendation for retesting.',date:s.Test_Date,related:s})}
  return {alerts:alerts.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))),policies:{weatherOutdatedDays:7,advisoryAgeDays:30,soilAgeDays:365},note:'All items come from stored database records. No external notifications are sent and no live weather is used.'}
 },
 async report(report,filters){
  const start=dateValue(filters.startDate,'Start date'),end=dateValue(filters.endDate,'End date')
  if(start&&end&&start>end)throw new AppError('Start date must be on or before end date.',400)
  const rows=await insightsRepository.reportData(report,{startDate:start,endDate:end})
  if(!rows)throw new AppError('Unknown report type.',404)
  const dateFields={cultivation:'Start_Date','soil-tests':'Test_Date','fertilizer-usage':'Usage_Date',advisories:'Advisory_Date','market-prices':'Date'}
  const field=dateFields[report]
  return {report,count:rows.length,rows,dateFilterSupported:Boolean(field),dateField:field||null}
 },
 audit(filters){return insightsRepository.farmerAudit({actionType:String(filters.actionType||'').slice(0,20)||undefined,startDate:dateValue(filters.startDate,'Start date'),endDate:dateValue(filters.endDate,'End date')})}
}
