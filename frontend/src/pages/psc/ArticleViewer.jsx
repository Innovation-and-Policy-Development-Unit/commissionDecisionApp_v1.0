import React, { useState, useEffect, useCallback } from 'react';
import { 
  Text, 
  Card, 
  Button,
  makeStyles,
  shorthands,
  tokens,
  Divider,
  Badge,
  Spinner
} from '@fluentui/react-components';
import { 
  ArrowLeftRegular, 
  EditRegular, 
  CalendarRegular,
  PersonRegular,
  LockClosedRegular,
  FolderRegular,
  PrintRegular,
  SparkleRegular
} from '@fluentui/react-icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import ReactMarkdown from 'react-markdown';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '24px',
    maxWidth: '900px',
    ...shorthands.margin('0', 'auto'),
    paddingBottom: '80px',
  },
  articleCard: {
    ...shorthands.padding('40px'),
    backgroundColor: tokens.colorNeutralBackground1,
    minHeight: '600px',
  },
  meta: {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: '24px',
    rowGap: '12px',
    color: tokens.colorNeutralForeground4,
    marginBottom: '32px',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  markdownContent: {
    '& h1': { fontSize: '2.5em', fontWeight: 'bold', marginBottom: '0.8em', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, paddingBottom: '0.3em' },
    '& h2': { fontSize: '1.8em', fontWeight: 'bold', marginTop: '1.5em', marginBottom: '0.6em' },
    '& h3': { fontSize: '1.4em', fontWeight: 'bold', marginTop: '1.2em', marginBottom: '0.5em' },
    '& p': { marginBottom: '1.2em', lineHeight: '1.8', fontSize: '1.1em' },
    '& ul, & ol': { marginLeft: '2em', marginBottom: '1.2em' },
    '& li': { marginBottom: '0.5em', lineHeight: '1.6' },
    '& blockquote': { borderLeft: `4px solid ${tokens.colorBrandBackground}`, paddingLeft: '1em', fontStyle: 'italic', color: tokens.colorNeutralForeground3, margin: '1.5em 0' },
    '& code': { backgroundColor: tokens.colorNeutralBackground2, padding: '0.2em 0.4em', borderRadius: '4px', fontFamily: 'monospace' },
    '& pre': { backgroundColor: tokens.colorNeutralBackground2, padding: '1em', borderRadius: '8px', overflowX: 'auto', margin: '1.5em 0' },
    '& table': { width: '100%', borderCollapse: 'collapse', margin: '1.5em 0' },
    '& th, & td': { border: `1px solid ${tokens.colorNeutralStroke1}`, padding: '0.8em', textAlign: 'left' },
    '& th': { backgroundColor: tokens.colorNeutralBackground2, fontWeight: 'bold' },
  }
});

export default function ArticleViewer() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { slug } = useParams();
  const { user } = useAuth();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadArticle = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/knowledge/articles/${slug}/`);
      setArticle(data);
    } catch (error) {
      console.error('KB Load Error:', error);
      navigate('/wiki');
    } finally {
      setLoading(false);
    }
  }, [slug, navigate]);

  useEffect(() => {
    loadArticle();
  }, [loadArticle]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Spinner size="large" label="Loading article..." />
      </div>
    );
  }

  const canEdit = user && (user.role === 'psc_admin' || user.is_staff);

  return (
    <div className={styles.container}>
      <div className="flex items-center justify-between no-print">
        <Button icon={<ArrowLeftRegular />} onClick={() => navigate('/wiki')}>
          Back to Wiki
        </Button>
        <div className="flex gap-2">
          <Button icon={<PrintRegular />} onClick={() => window.print()}>Print</Button>
          {canEdit && (
            <Button 
              appearance="primary" 
              icon={<EditRegular />} 
              onClick={() => navigate(`/admin/knowledge-base/edit/${slug}`)}
            >
              Edit Article
            </Button>
          )}
        </div>
      </div>

      <Card className={styles.articleCard}>
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-4 no-print">
             <Badge appearance="tint" color="brand" icon={<FolderRegular />}>
               {article.category_title}
             </Badge>
             {article.is_internal && <Badge appearance="outline" color="warning" icon={<LockClosedRegular />}>PSC Internal</Badge>}
             {!article.is_published && <Badge appearance="ghost" color="informative">Draft</Badge>}
          </div>

          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-6">
            {article.title}
          </h1>

          <div className={styles.meta}>
            <div className={styles.metaItem}>
              <PersonRegular fontSize={16} />
              <Text size={200}>{article.author_username || 'OPSC Secretariat'}</Text>
            </div>
            <div className={styles.metaItem}>
              <CalendarRegular fontSize={16} />
              <Text size={200}>Last updated {new Date(article.updated_at).toLocaleDateString()}</Text>
            </div>
          </div>

          <Divider className="mb-10" />

          <div className={styles.markdownContent}>
            <ReactMarkdown>{article.content}</ReactMarkdown>
          </div>
        </div>
      </Card>

      {/* Internal Feedback Card */}
      <Card appearance="subtle" className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 no-print">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <InfoRegular className="text-slate-400" />
            <Text size={200} className="text-slate-500 italic">
              Was this article helpful? If you found an error, please contact the OPSC Secretariat.
            </Text>
          </div>
          <Button appearance="subtle" size="small">Report Issue</Button>
        </div>
      </Card>
    </div>
  );
}
