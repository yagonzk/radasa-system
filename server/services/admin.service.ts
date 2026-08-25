import{prisma}from"../lib/prisma.js";import{AppError}from"../utils/app-error.js";
export const adminService={
 usuarios:()=>prisma.user.findMany({orderBy:{name:"asc"},select:{id:true,name:true,username:true,email:true,role:true,active:true,motoristaId:true,permissoes:true,createdAt:true}}),
 async atualizarAcesso(id:string,i:any){const u=await prisma.user.findUnique({where:{id}});if(!u)throw new AppError(404,"Usuário não encontrado.");return prisma.user.update({where:{id},data:{role:i.role??u.role,active:i.active??u.active,motoristaId:i.motoristaId===undefined?u.motoristaId:(i.motoristaId||null),permissoes:i.permissoes??u.permissoes},select:{id:true,name:true,username:true,email:true,role:true,active:true,motoristaId:true,permissoes:true}})},
 configuracoes:()=>prisma.configuracaoSistema.findMany({orderBy:{chave:"asc"}}),
 async salvarConfiguracao(chave:string,valor:any){return prisma.configuracaoSistema.upsert({where:{chave},create:{chave,valor},update:{valor}})},
 logs:()=>prisma.auditLog.findMany({orderBy:{createdAt:"desc"},take:1000,include:{user:{select:{name:true,username:true,email:true}}}})
};
