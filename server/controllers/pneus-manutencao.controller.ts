import type { Request, Response } from "express";
import { pneusManutencaoService } from "../services/pneus-manutencao.service.js";
import { requestParam } from "../utils/request-param.js";
export const pneusManutencaoController={
 get:async(req:Request,res:Response)=>res.json(await pneusManutencaoService.get(requestParam(req.params.id))),
 addSulco:async(req:Request,res:Response)=>res.status(201).json(await pneusManutencaoService.addSulco(requestParam(req.params.id),req.body)),
 addCalibragem:async(req:Request,res:Response)=>res.status(201).json(await pneusManutencaoService.addCalibragem(requestParam(req.params.id),req.body)),
 addRecapagem:async(req:Request,res:Response)=>res.status(201).json(await pneusManutencaoService.addRecapagem(requestParam(req.params.id),req.body)),
 addConserto:async(req:Request,res:Response)=>res.status(201).json(await pneusManutencaoService.addConserto(requestParam(req.params.id),req.body)),
 addInspecao:async(req:Request,res:Response)=>res.status(201).json(await pneusManutencaoService.addInspecao(requestParam(req.params.id),req.body)),
};
