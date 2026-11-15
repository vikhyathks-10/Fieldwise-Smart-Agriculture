import { toAppError } from '../../utils/errors.js'
export function errorHandler(err,_req,res,_next){
  const appError=toAppError(err)
  if(appError.status>=500)console.error(err)
  res.status(appError.status).json({error:appError.publicMessage,detail:process.env.NODE_ENV==='development'?err.message:undefined,transactionStatus:appError.transactionStatus})
}
