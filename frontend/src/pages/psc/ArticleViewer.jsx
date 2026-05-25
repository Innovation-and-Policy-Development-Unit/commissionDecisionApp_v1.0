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
} from '@fluentui/react-icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { userIsAdmin } from '../../utils/adminAccess';
import { formatApiError } from '../../utils/apiError';
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
  guideFrameWrap: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 8rem)',
    maxWidth: 'none',
    width: '100%',
    ...shorthands.margin('0', 'auto'),
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
  const [accessError, setAccessError] = useState('');
  const [htmlAvailable, setHtmlAvailable] = useState(null);

  const loadArticle = useCallback(async () => {
    setLoading(true);
    setAccessError('');
    try {
      const { data } = await api.get(`/knowledge/articles/${slug}/`);
      setArticle(data);
    } catch (error) {
      console.error('KB Load Error:', error);
      if (error?.response?.status === 403) {
        setAccessError(formatApiError(error, 'You do not have access to this guide.'));
      } else {
        navigate('/wiki');
      }
    } finally {
      setLoading(false);
    }
  }, [slug, navigate]);

  useEffect(() => {
    loadArticle();
  }, [loadArticle]);

  useEffect(() => {
    if (!article || article.content_type !== 'html_iframe' || !article.html_asset) {
      setHtmlAvailable(null);
      return;
    }
    fetch(`/guides/${article.html_asset}`, { method: 'HEAD' })
      .then((r) => setHtmlAvailable(r.ok))
      .catch(() => setHtmlAvailable(false));
  }, [article]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Spinner size="large" label="Loading article..." />
      </div>
    );
  }

  if (accessError) {
    return (
      <div className={styles.container}>
        <Button icon={<ArrowLeftRegular />} onClick={() => navigate('/wiki')}>
          Back to Wiki
        </Button>
        <Card className={styles.articleCard}>
          <Text weight="semibold" size={500}>Access restricted</Text>
          <Text className="mt-2">{accessError}</Text>
        </Card>
      </div>
    );
  }

  if (!article) return null;

  const canEdit = user && (userIsAdmin(user) || user.role === 'psc_admin' || user.is_staff);
  const isHtmlGuide = article.content_type === 'html_iframe' && article.html_asset;

  if (isHtmlGuide) {
    return (
      <div className={styles.guideFrameWrap}>
        <div className="shrink-0 flex items-center justify-between gap-2 px-1 py-2 no-print">
          <Button icon={<ArrowLeftRegular />} onClick={() => navigate('/wiki')}>
            Back to Wiki
          </Button>
          {canEdit && (
            <Button
              appearance="primary"
              icon={<EditRegular />}
              onClick={() => navigate(`/admin/knowledge-base/edit/${slug}`)}
            >
              Edit
            </Button>
          )}
        </div>
        {htmlAvailable === false ? (
          <Card className="flex-1 flex items-center justify-center p-8">
            <Text>
              Guide HTML is not deployed yet. Render the Quarto source into{' '}
              <code>frontend/public/guides/{article.html_asset}</code> and redeploy the web app.
            </Text>
          </Card>
        ) : htmlAvailable === true ? (
          <iframe
            src={`/guides/${article.html_asset}`}
            className="flex-1 w-full border-0 rounded-lg border border-slate-200 dark:border-slate-700"
            title={article.title}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <Spinner size="medium" label="Loading guide..." />
          </div>
        )}
      </div>
    );
  }

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
    </div>
  );
}
