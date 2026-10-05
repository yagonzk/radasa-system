import type{Request,Response}from"express";
import{dashboardService as s}from"../services/dashboard.service.js";
export const dashboardController={
 gerencial:async(_r:Request,res:Response)=>res.json(await s.gerencial()),
 financeiro:async(_r:Request,res:Response)=>res.json(await s.financeiro()),
 rankings:async(_r:Request,res:Response)=>res.json(await s.rankings()),
 alertas:async(r:Request,res:Response)=>{const raw=Number(r.query.limit||0);const limit=Number.isFinite(raw)&&raw>0?Math.floor(raw):undefined;res.json(await s.alertas(limit))}
};
