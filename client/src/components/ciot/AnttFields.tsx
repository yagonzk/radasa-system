import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export type AnttFieldsState = {
  idOperacaoTransporte: string;
  distanciaPercorrida: string;
  codigoMunicipioOrigem: string;
  codigoMunicipioDestino: string;
  cepOrigem: string;
  cepDestino: string;
  codigoNaturezaCarga: string;
  codigoTipoCarga: string;
  numeroEixos: string;
  tipoPagamento: string;
  cpfCnpjCreditado: string;
  codigoInstituicaoFinanceira: string;
  numeroAgencia: string;
  numeroConta: string;
  chavePix: string;
  identificadorPix: string;
  indPagamento: "0" | "1";
  indAltoDesempenho: boolean;
  indRetornoVazio: boolean;
  composicaoVeicular: boolean;
  cpfCnpjDestinatario: string;
  parcelas: Array<{
    numeroParcela: number;
    dataVencimento: string;
    valorParcela: number;
  }>;
  veiculosAdicionais: Array<{
    placa: string;
    rntrc: string;
    numeroEixos: number;
  }>;
};
const loads = [
  "Granel sólido",
  "Granel líquido",
  "Frigorificada ou aquecida",
  "Conteinerizada",
  "Carga geral",
  "Neogranel",
  "Perigosa: granel sólido",
  "Perigosa: granel líquido",
  "Perigosa: refrigerada",
  "Perigosa: conteinerizada",
  "Perigosa: carga geral",
  "Granel pressurizada",
];
export function AnttFields({
  section,
  value,
  onChange,
}: {
  section: "operation" | "finance" | "fleet";
  value: AnttFieldsState;
  onChange: (value: AnttFieldsState) => void;
}) {
  const id = useId();
  const change = (key: keyof AnttFieldsState, v: unknown) =>
    onChange({ ...value, [key]: v });
  const field = (key: keyof AnttFieldsState, label: string, type = "text") => (
    <label className="grid gap-2 text-sm" htmlFor={`${id}-${key}`} key={key}>
      {label}
      <Input
        id={`${id}-${key}`}
        type={type}
        value={String(value[key] ?? "")}
        onChange={(e) => change(key, e.target.value)}
      />
    </label>
  );
  const select = (
    key: keyof AnttFieldsState,
    label: string,
    options: Array<[string, string]>,
  ) => (
    <label className="grid gap-2 text-sm" htmlFor={`${id}-${key}`} key={key}>
      {label}
      <select
        id={`${id}-${key}`}
        className="h-10 w-full rounded-md border bg-background px-3"
        value={String(value[key])}
        onChange={(e) => change(key, e.target.value)}
      >
        <option value="">Selecione</option>
        {options.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="space-y-4 rounded-xl border p-5">
      <h3 className="font-semibold">
        {section === "operation"
          ? "Rota e carga para emissão"
          : section === "finance"
            ? "Recebimento do frete"
            : "Composição da frota"}
      </h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {section === "operation" && (
          <>
            {field(
              "distanciaPercorrida",
              "Distância percorrida (km inteiros)",
              "number",
            )}
            {field("codigoMunicipioOrigem", "Código IBGE da origem")}
            {field("codigoMunicipioDestino", "Código IBGE do destino")}
            {field("cepOrigem", "CEP de origem")}
            {field("cepDestino", "CEP de destino")}
            {field("cpfCnpjDestinatario", "CPF/CNPJ do destinatário da carga")}
            {field("codigoNaturezaCarga", "NCM: quatro primeiros dígitos")}
            {select(
              "codigoTipoCarga",
              "Tipo de carga",
              loads.map((label, index) => [String(index + 1), label]),
            )}
          </>
        )}
        {section === "finance" && (
          <>
            {select("tipoPagamento", "Meio de pagamento", [
              ["2", "Conta corrente"],
              ["3", "Conta poupança"],
              ["4", "Conta pagamento"],
              ["5", "Outros"],
              ["6", "Pix"],
            ])}
            {field("cpfCnpjCreditado", "CPF/CNPJ de quem recebe")}
            {select("indPagamento", "Condição de pagamento", [
              ["0", "À vista"],
              ["1", "A prazo"],
            ])}
            {value.tipoPagamento === "6" && (
              <>
                {field("chavePix", "Chave Pix")}
                {field("identificadorPix", "Identificador Pix da operação")}
              </>
            )}
            {["2", "3", "4"].includes(value.tipoPagamento) && (
              <>
                {field(
                  "codigoInstituicaoFinanceira",
                  "Código da instituição financeira",
                )}
                {field("numeroAgencia", "Agência")}
                {field("numeroConta", "Conta")}
              </>
            )}
          </>
        )}
        {section === "fleet" &&
          select("numeroEixos", "Eixos do veículo automotor", [
            ["2", "2 eixos"],
            ["3", "3 eixos"],
            ["4", "4 eixos"],
          ])}
      </div>
      {section === "operation" && (
        <div className="flex flex-wrap gap-5">
          {(
            [
              ["indAltoDesempenho", "Alto desempenho"],
              ["indRetornoVazio", "Retorno vazio"],
              ["composicaoVeicular", "Composição veicular"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value[key]}
                onChange={(e) => change(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
      )}
      {section === "finance" && value.indPagamento === "1" && (
        <div className="space-y-3">
          {value.parcelas.map((p, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-lg bg-muted/30 p-3 sm:grid-cols-3"
            >
              <label className="text-sm">
                Parcela {index + 1}: vencimento
                <Input
                  type="date"
                  value={p.dataVencimento}
                  onChange={(e) =>
                    change(
                      "parcelas",
                      value.parcelas.map((v, i) =>
                        i === index
                          ? { ...v, dataVencimento: e.target.value }
                          : v,
                      ),
                    )
                  }
                />
              </label>
              <label className="text-sm">
                Valor (R$)
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={p.valorParcela || ""}
                  onChange={(e) =>
                    change(
                      "parcelas",
                      value.parcelas.map((v, i) =>
                        i === index
                          ? { ...v, valorParcela: Number(e.target.value) }
                          : v,
                      ),
                    )
                  }
                />
              </label>
              <Button
                variant="outline"
                onClick={() =>
                  change(
                    "parcelas",
                    value.parcelas
                      .filter((_, i) => i !== index)
                      .map((v, i) => ({ ...v, numeroParcela: i + 1 })),
                  )
                }
              >
                Remover parcela
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              change("parcelas", [
                ...value.parcelas,
                {
                  numeroParcela: value.parcelas.length + 1,
                  dataVencimento: "",
                  valorParcela: 0,
                },
              ])
            }
          >
            Adicionar parcela
          </Button>
        </div>
      )}
      {section === "fleet" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Adicione os reboques e semirreboques separadamente. O cavalo-trator
            exige ao menos um implemento.
          </p>
          {value.veiculosAdicionais.map((v, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-lg bg-muted/30 p-3 sm:grid-cols-4"
            >
              <label className="text-sm">
                Placa do implemento
                <Input
                  value={v.placa}
                  maxLength={7}
                  onChange={(e) =>
                    change(
                      "veiculosAdicionais",
                      value.veiculosAdicionais.map((item, i) =>
                        i === index
                          ? { ...item, placa: e.target.value.toUpperCase() }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label className="text-sm">
                RNTRC
                <Input
                  value={v.rntrc}
                  maxLength={9}
                  onChange={(e) =>
                    change(
                      "veiculosAdicionais",
                      value.veiculosAdicionais.map((item, i) =>
                        i === index ? { ...item, rntrc: e.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
              <label className="text-sm">
                Eixos
                <Input
                  type="number"
                  min={1}
                  max={4}
                  value={v.numeroEixos}
                  onChange={(e) =>
                    change(
                      "veiculosAdicionais",
                      value.veiculosAdicionais.map((item, i) =>
                        i === index
                          ? { ...item, numeroEixos: Number(e.target.value) }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <Button
                variant="outline"
                onClick={() =>
                  change(
                    "veiculosAdicionais",
                    value.veiculosAdicionais.filter((_, i) => i !== index),
                  )
                }
              >
                Remover implemento
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            disabled={value.veiculosAdicionais.length >= 5}
            onClick={() =>
              change("veiculosAdicionais", [
                ...value.veiculosAdicionais,
                { placa: "", rntrc: "", numeroEixos: 2 },
              ])
            }
          >
            Adicionar implemento
          </Button>
        </div>
      )}
    </div>
  );
}
