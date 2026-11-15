export class AppError extends Error {
  constructor(message, status = 500, publicMessage = message) { super(message); this.status = status; this.publicMessage = publicMessage }
}
export function toAppError(err) {
  if (err instanceof AppError) return err
  let appError
  if (['ER_NO_SUCH_TABLE','ER_BAD_DB_ERROR','ECONNREFUSED','PROTOCOL_CONNECTION_LOST'].includes(err.code)) appError=new AppError(err.message,503,'Database unavailable or schema does not match the supplied DDL. Check backend/.env and MySQL.')
  else if (err.code === 'ER_DUP_ENTRY') appError=new AppError(err.message,409,'That primary key already exists.')
  else if (['ER_ROW_IS_REFERENCED_2','ER_NO_REFERENCED_ROW_2'].includes(err.code)) appError=new AppError(err.message,409,'A related record prevents this change. Check the foreign key relationships.')
  else appError=new AppError(err.message,500,'Database request failed.')
  if(err.transactionStatus)appError.transactionStatus=err.transactionStatus
  return appError
}
