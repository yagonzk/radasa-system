import { useRef, useState, type ReactNode } from "react";
import * as XLSX from "xlsx";
import { useClientes, type Cliente } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import DataTable from "./DataTable";
import { Plus, Building2, Upload, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

interface FormState {
  nomeFantasia: string;
  razaoSocial: string;
  codigoInterno: string;
  cnpj: string;
  email: string;
  telefone: string;
  enderecoFiscal: string;
}

interface ImportRow extends FormState {
  rowNumber: number;
  status: "valid" | "invalid" | "duplicate";
  error?: string;
}

const emptyForm: FormState = {
  nomeFantasia: "",
  razaoSocial: "",
  codigoInterno: "",
  cnpj: "",
  email: "",
  telefone: "",
  enderecoFiscal: "",
};

const HEADER_ALIASES: Record<keyof FormState, string[]> = {
  nomeFantasia: ["nome fantasia", "nome", "cliente", "razao social", "razão social"],
  codigoInterno: ["codigo interno", "código interno", "codigo", "código", "cod cliente", "cod. cliente"],
  cnpj: ["cnpj", "cnpj cliente", "documento", "documento fiscal"],
  email: ["email", "e-mail"],
  telefone: ["telefone", "fone", "celular"],
  enderecoFiscal: ["endereco fiscal", "endereço fiscal", "endereco", "endereço"],
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function isValidCnpj(value: string) {
  const cnpj = onlyDigits(value);
  if (!cnpj) return true;
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const digit = (length: 12 | 13) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const total = cnpj
      .slice(0, length)
      .split("")
      .reduce((sum, number, index) => sum + Number(number) * weights[index], 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return Number(cnpj[12]) === digit(12) && Number(cnpj[13]) === digit(13);
}

function findValue(row: Record<string, unknown>, field: keyof FormState) {
  const aliases = HEADER_ALIASES[field].map(normalizeHeader);
  const key = Object.keys(row).find((item) => aliases.includes(normalizeHeader(item)));
  return key ? normalizeValue(row[key]) : "";
}

export default function ClienteTab() {
  const { items, create, update, remove } = useClientes();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setOpen(true);
  };

  const handleOpenImport = () => {
    setImportRows([]);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setImportOpen(true);
  };

  const handleOpenEdit = (item: Cliente) => {
    setForm({
      nomeFantasia: item.nomeFantasia,
      razaoSocial: item.razaoSocial || "",
      codigoInterno: item.codigoInterno,
      cnpj: item.cnpj || "",
      email: item.email,
      telefone: item.telefone,
      enderecoFiscal: item.enderecoFiscal,
    });
    setEditingId(item.id);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cnpj = onlyDigits(form.cnpj);
    if (cnpj && !isValidCnpj(cnpj)) {
      toast.error("Informe um CNPJ válido.");
      return;
    }

    if (
      cnpj &&
      items.some(
        (item) => item.id !== editingId && onlyDigits(item.cnpj || "") === cnpj,
      )
    ) {
      toast.error("Já existe um cliente cadastrado com este CNPJ.");
      return;
    }

    const payload = { ...form, cnpj };

    if (editingId) {
      await Promise.resolve(update(editingId, payload));
      toast.success("Cliente atualizado com sucesso!");
    } else {
      await Promise.resolve(create(payload));
      toast.success("Cliente cadastrado com sucesso!");
    }
    setOpen(false);
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        "Nome Fantasia": "Cliente Exemplo",
        "Razão Social": "Cliente Exemplo Comércio e Serviços Ltda.",
        "Código Interno": "1001",
        CNPJ: "15.209.274/0001-62",
        Email: "cliente@exemplo.com",
        Telefone: "(65) 99999-9999",
        "Endereço Fiscal": "Rua Exemplo, 123 - Cuiabá/MT",
      },
    ]);
    worksheet["!cols"] = [
      { wch: 30 },
      { wch: 40 },
      { wch: 18 },
      { wch: 22 },
      { wch: 30 },
      { wch: 20 },
      { wch: 45 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");
    XLSX.writeFile(workbook, "modelo-importacao-clientes.xlsx");
  };

  const handleFile = async (file?: File) => {
    if (!file) return;

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("Selecione uma planilha Excel no formato .xlsx ou .xls.");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
        defval: "",
        raw: false,
      });

      if (!rawRows.length) {
        toast.error("A planilha está vazia.");
        return;
      }

      const existingCodes = new Set(
        items.map((item) => normalizeHeader(item.codigoInterno)).filter(Boolean),
      );
      const existingEmails = new Set(
        items.map((item) => normalizeHeader(item.email)).filter(Boolean),
      );
      const existingCnpjs = new Set(
        items.map((item) => onlyDigits(item.cnpj || "")).filter(Boolean),
      );
      const fileCodes = new Set<string>();
      const fileCnpjs = new Set<string>();
      const fileEmails = new Set<string>();

      const parsed = rawRows.map((raw, index): ImportRow => {
        const row: FormState = {
          nomeFantasia: findValue(raw, "nomeFantasia"),
          razaoSocial: findValue(raw, "razaoSocial"),
          codigoInterno: findValue(raw, "codigoInterno"),
          cnpj: onlyDigits(findValue(raw, "cnpj")),
          email: findValue(raw, "email"),
          telefone: findValue(raw, "telefone"),
          enderecoFiscal: findValue(raw, "enderecoFiscal"),
        };

        const code = normalizeHeader(row.codigoInterno);
        const cnpj = onlyDigits(row.cnpj);
        const email = normalizeHeader(row.email);
        const errors: string[] = [];

        if (!row.nomeFantasia) errors.push("Nome Fantasia obrigatório");
        if (!row.codigoInterno) errors.push("Código Interno obrigatório");
        if (row.cnpj && !isValidCnpj(row.cnpj)) errors.push("CNPJ inválido");
        if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
          errors.push("E-mail inválido");
        }

        const duplicated =
          (code && (existingCodes.has(code) || fileCodes.has(code))) ||
          (cnpj && (existingCnpjs.has(cnpj) || fileCnpjs.has(cnpj))) ||
          (email && (existingEmails.has(email) || fileEmails.has(email)));

        if (code) fileCodes.add(code);
        if (cnpj) fileCnpjs.add(cnpj);
        if (email) fileEmails.add(email);

        return {
          ...row,
          rowNumber: index + 2,
          status: errors.length ? "invalid" : duplicated ? "duplicate" : "valid",
          error: errors.length
            ? errors.join("; ")
            : duplicated
              ? "Cliente duplicado por código, CNPJ ou e-mail"
              : undefined,
        };
      });

      setFileName(file.name);
      setImportRows(parsed);
      toast.success(`${parsed.length} linha(s) lida(s) da planilha.`);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível ler a planilha. Confira o arquivo e tente novamente.");
    }
  };

  const handleImport = async () => {
    const validRows = importRows.filter((row) => row.status === "valid");
    if (!validRows.length) {
      toast.error("Não existem clientes válidos para importar.");
      return;
    }

    setImporting(true);
    let imported = 0;
    let failed = 0;

    for (const row of validRows) {
      try {
        await Promise.resolve(
          create({
            nomeFantasia: row.nomeFantasia,
            razaoSocial: row.razaoSocial,
            codigoInterno: row.codigoInterno,
            cnpj: onlyDigits(row.cnpj),
            email: row.email,
            telefone: row.telefone,
            enderecoFiscal: row.enderecoFiscal,
          }),
        );
        imported += 1;
      } catch (error) {
        console.error(`Erro na linha ${row.rowNumber}:`, error);
        failed += 1;
      }
    }

    setImporting(false);
    toast.success(
      `${imported} cliente(s) importado(s)${failed ? ` e ${failed} falha(s)` : ""}.`,
    );

    if (!failed) setImportOpen(false);
  };

  const validCount = importRows.filter((row) => row.status === "valid").length;
  const duplicateCount = importRows.filter((row) => row.status === "duplicate").length;
  const invalidCount = importRows.filter((row) => row.status === "invalid").length;

  const columns: { key: string; label: string; render?: (item: Cliente) => ReactNode }[] = [
    {
      key: "nomeFantasia",
      label: "Nome Fantasia",
      render: (item: Cliente) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <Building2 className="h-4 w-4" />
          </div>
          <span className="font-medium">{item.nomeFantasia || "—"}</span>
        </div>
      ),
    },
    { key: "codigoInterno", label: "Código Interno" },
    {
      key: "cnpj",
      label: "CNPJ",
      render: (item: Cliente) => item.cnpj ? formatCnpj(item.cnpj) : "—",
    },
    { key: "email", label: "Email" },
    { key: "telefone", label: "Telefone" },
    { key: "enderecoFiscal", label: "Endereço Fiscal" },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} cliente(s) cadastrado(s)
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={handleOpenImport} size="sm" variant="outline">
            <Upload className="mr-1.5 h-4 w-4" />
            Importar
          </Button>
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={items}
        onEdit={handleOpenEdit}
        onDelete={(item) => remove(item.id)}
        emptyMessage="Nenhum cliente cadastrado. Clique em 'Novo Cliente' para começar."
      />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar clientes por Excel</DialogTitle>
            <DialogDescription>
              Use o modelo abaixo ou envie uma planilha com as colunas Nome Fantasia, Razão Social,
              Código Interno, CNPJ, Email, Telefone e Endereço Fiscal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Baixar modelo
              </Button>
              <Button type="button" onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Selecionar planilha
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
            </div>

            {!!importRows.length && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Prontos para importar</p>
                    <p className="text-2xl font-semibold">{validCount}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Duplicados</p>
                    <p className="text-2xl font-semibold">{duplicateCount}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Com erro</p>
                    <p className="text-2xl font-semibold">{invalidCount}</p>
                  </div>
                </div>

                <div className="max-h-[420px] overflow-auto rounded-md border">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="p-2 text-left">Linha</th>
                        <th className="p-2 text-left">Nome Fantasia</th>
                        <th className="p-2 text-left">Razão Social</th>
                        <th className="p-2 text-left">Código</th>
                        <th className="p-2 text-left">E-mail</th>
                        <th className="p-2 text-left">Telefone</th>
                        <th className="p-2 text-left">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 200).map((row) => (
                        <tr key={`${row.rowNumber}-${row.codigoInterno}`} className="border-t">
                          <td className="p-2">{row.rowNumber}</td>
                          <td className="p-2">{row.nomeFantasia || "—"}</td>
                          <td className="p-2">{row.razaoSocial || "—"}</td>
                          <td className="p-2">{row.codigoInterno || "—"}</td>
                          <td className="p-2">{row.email || "—"}</td>
                          <td className="p-2">{row.telefone || "—"}</td>
                          <td className="p-2">
                            {row.status === "valid" ? (
                              <span className="text-emerald-600">Pronto</span>
                            ) : (
                              <span className="text-destructive">{row.error}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importRows.length > 200 && (
                  <p className="text-xs text-muted-foreground">
                    A prévia mostra as primeiras 200 linhas. Todas as linhas válidas serão importadas.
                  </p>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!validCount || importing}
              onClick={() => void handleImport()}
            >
              {importing ? "Importando..." : `Importar ${validCount} cliente(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Nome Fantasia">
                <Input
                  value={form.nomeFantasia}
                  onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
                  placeholder="Nome fantasia"
                />
              </FormField>
              <FormField label="Razão Social">
                <Input
                  value={form.razaoSocial}
                  onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                  placeholder="Nome empresarial completo"
                />
              </FormField>
            </div>
            <FormField label="Código Interno">
              <Input
                value={form.codigoInterno}
                onChange={(e) => setForm({ ...form, codigoInterno: e.target.value })}
                placeholder="Ex: 1001"
              />
            </FormField>
            <FormField label="CNPJ">
              <Input
                value={formatCnpj(form.cnpj)}
                onChange={(e) =>
                  setForm({ ...form, cnpj: onlyDigits(e.target.value).slice(0, 14) })
                }
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                maxLength={18}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </FormField>
              <FormField label="Telefone">
                <Input
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </FormField>
            </div>
            <FormField label="Endereço Fiscal">
              <Input
                value={form.enderecoFiscal}
                onChange={(e) => setForm({ ...form, enderecoFiscal: e.target.value })}
                placeholder="Endereço fiscal completo"
              />
            </FormField>
            <DialogFooter>
              <Button type="submit">
                {editingId ? "Salvar alterações" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
