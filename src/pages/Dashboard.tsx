import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, AlertTriangle, TrendingUp, ShieldAlert } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const stats = [
  { label: "Total de Processos", value: "24", icon: ClipboardList, color: "text-primary" },
  { label: "Processos Críticos", value: "5", icon: AlertTriangle, color: "text-destructive" },
  { label: "Riscos Identificados", value: "18", icon: ShieldAlert, color: "text-warning" },
  { label: "Melhorias Propostas", value: "32", icon: TrendingUp, color: "text-success" },
];

const processosPorArea = [
  { area: "Comercial", quantidade: 6 },
  { area: "Operações", quantidade: 8 },
  { area: "Financeiro", quantidade: 4 },
  { area: "RH", quantidade: 3 },
  { area: "TI", quantidade: 3 },
];

const riskData = [
  { name: "Baixo", value: 10, color: "hsl(152, 60%, 40%)" },
  { name: "Médio", value: 8, color: "hsl(38, 92%, 50%)" },
  { name: "Alto", value: 4, color: "hsl(0, 84%, 60%)" },
  { name: "Crítico", value: 2, color: "hsl(0, 70%, 40%)" },
];

const Dashboard = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral dos processos da organização</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                </div>
                <stat.icon className={`h-10 w-10 ${stat.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Processos por Área</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={processosPorArea}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 30%, 85%)" />
                <XAxis dataKey="area" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="quantidade" fill="hsl(180, 100%, 21%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nível de Risco</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={riskData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {riskData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
