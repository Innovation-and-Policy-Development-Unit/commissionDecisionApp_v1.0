import React, { useState, useCallback } from 'react';
import { 
  Text, 
  Input, 
  Button, 
  Card, 
  CardHeader,
  Spinner,
  makeStyles, 
  shorthands, 
  tokens 
} from '@fluentui/react-components';
import { 
  SparkleRegular, 
  SendRegular, 
  ChartBarRegular, 
  ArrowDownloadRegular,
  InfoRegular
} from '@fluentui/react-icons';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';
import PageHeader from '../../components/shared/PageHeader';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '24px',
    maxWidth: '1200px',
    ...shorthands.margin('0', 'auto'),
    paddingBottom: '40px',
  },
  searchSection: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.padding('32px'),
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    boxShadow: tokens.shadow16,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '16px',
  },
  inputWrapper: {
    display: 'flex',
    columnGap: '12px',
  },
  chartCard: {
    minHeight: '400px',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    columnGap: '16px',
    rowGap: '16px',
  }
});

const COLORS = ['#0078d4', '#107c10', '#d13438', '#ffaa44', '#5c2d91'];

export default function SmartReports() {
  const styles = useStyles();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleAskAI = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data } = await api.post('/reports/ai-smart-query/', { query });
      if (data?.detail && !data?.chartData && !data?.kpis) {
        setErrorMessage(data.detail);
        setReportData(null);
        return;
      }
      setReportData(data);
    } catch (error) {
      const detail =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        error.message ||
        'Smart report request failed.';
      setErrorMessage(detail);
      setReportData(null);
      console.error('Smart Report Error:', error);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div className={styles.container}>
      <PageHeader 
        title="Smart Reports" 
        subtitle="Ask questions about submissions or commission meetings in natural language."
      />

      {/* AI Query Bar */}
      <div className={styles.searchSection}>
        <div className="flex items-center gap-2 mb-2">
          <SparkleRegular fontSize={20} primaryFill={tokens.colorBrandForeground1} />
          <Text weight="semibold" size={400}>Ask SCDMS Intelligence</Text>
        </div>
        <div className={styles.inputWrapper}>
          <Input 
            size="large"
            placeholder="e.g., 'Show me acting appointments for MOH approved last month'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
            contentAfter={loading ? <Spinner size="tiny" /> : <SparkleRegular />}
          />
          <Button 
            appearance="primary" 
            size="large" 
            icon={<SendRegular />}
            onClick={handleAskAI}
            disabled={loading}
          >
            Generate Report
          </Button>
        </div>
        <div className="flex gap-4 mt-2">
          <Text size={200} className="text-slate-400 italic">Try: "Compare training requests by ministry" or "What is our average turnaround time this year?"</Text>
        </div>
        {errorMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            <InfoRegular className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {reportData && (
        <div className="animate-fade-in space-y-6">
          
          {/* AI Executive Summary */}
          <Card appearance="subtle" className="bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/50">
            <CardHeader 
              header={<Text weight="bold">AI Insight</Text>}
              description={<Text size={300}>{reportData.summary}</Text>}
            />
          </Card>

          {/* KPI Row */}
          {reportData.kpis && (
            <div className={styles.kpiGrid}>
              {reportData.kpis.map((kpi, i) => (
                <Card key={i} appearance="outline">
                  <Text size={200} weight="medium" className="text-slate-500 uppercase">{kpi.label}</Text>
                  <Text size={700} weight="bold">{kpi.value}</Text>
                </Card>
              ))}
            </div>
          )}

          {/* Main Visualization */}
          {reportData.chartData && (
            <Card appearance="outline" className={styles.chartCard}>
              <CardHeader 
                header={<Text weight="bold">{reportData.chartTitle || 'Report Data'}</Text>}
                action={<Button appearance="subtle" icon={<ArrowDownloadRegular />}>Export</Button>}
              />
              <div className="h-[350px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  {reportData.chartType === 'bar' ? (
                    <BarChart data={reportData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill={tokens.colorBrandBackground} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={reportData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke={tokens.colorBrandBackground} strokeWidth={3} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
