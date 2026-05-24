import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Text, 
  Button, 
  Card, 
  Input, 
  Field, 
  Textarea, 
  Select, 
  Switch,
  makeStyles,
  shorthands,
  tokens,
  Divider
} from '@fluentui/react-components';
import { 
  SaveRegular, 
  DismissRegular, 
  ArrowLeftRegular,
  EyeRegular,
  SparkleRegular
} from '@fluentui/react-icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/shared/PageHeader';
import ReactMarkdown from 'react-markdown';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '24px',
    maxWidth: '1200px',
    ...shorthands.margin('0', 'auto'),
    paddingBottom: '40px',
  },
  editorGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: '24px',
    minHeight: '600px',
    '@media (max-width: 1024px)': {
      gridTemplateColumns: '1fr',
      rowGap: '24px',
    },
  },
  pane: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '16px',
    ...shorthands.padding('24px'),
  },
  previewPane: {
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding('24px'),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    maxHeight: '800px',
    overflowY: 'auto',
  },
  markdownContent: {
    '& h1': { fontSize: '2em', fontWeight: 'bold', marginBottom: '0.5em' },
    '& h2': { fontSize: '1.5em', fontWeight: 'bold', marginTop: '1em', marginBottom: '0.5em' },
    '& p': { marginBottom: '1em', lineHeight: '1.6' },
    '& ul': { listStyleType: 'disc', marginLeft: '1.5em', marginBottom: '1em' },
    '& code': { backgroundColor: '#f0f0f0', padding: '0.2em 0.4em', borderRadius: '3px' },
  }
});

export default function KnowledgeArticleEditor() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { slug } = useParams();
  const toast = useToast();
  const isEdit = Boolean(slug);

  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    category: '',
    content: '',
    is_published: false,
    is_internal: true
  });
  const [loading, setLoading] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const { data } = await api.get('/knowledge/categories/');
      setCategories(data.results || data);
    } catch (error) {
      toast.error('Failed to load categories.');
    }
  }, [toast]);

  const loadArticle = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/knowledge/articles/${slug}/`);
      setFormData({
        title: data.title,
        slug: data.slug,
        category: data.category,
        content: data.content,
        is_published: data.is_published,
        is_internal: data.is_internal
      });
    } catch (error) {
      toast.error('Failed to load article.');
      navigate('/admin/knowledge-base');
    } finally {
      setLoading(false);
    }
  }, [slug, navigate, toast]);

  useEffect(() => {
    loadCategories();
    if (isEdit) loadArticle();
  }, [loadCategories, loadArticle, isEdit]);

  const handleTitleChange = (e) => {
    const val = e.target.value;
    setFormData(prev => ({
      ...prev,
      title: val,
      slug: isEdit ? prev.slug : val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    }));
  };

  const handleSave = async () => {
    if (!formData.title || !formData.category || !formData.content) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        await api.patch(`/knowledge/articles/${slug}/`, formData);
        toast.success('Article updated.');
      } else {
        await api.post('/knowledge/articles/', formData);
        toast.success('Article created.');
      }
      navigate('/admin/knowledge-base');
    } catch (error) {
      const msg = error.response?.data?.slug ? 'Slug already exists.' : 'Failed to save article.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className="flex items-center justify-between">
        <Button icon={<ArrowLeftRegular />} onClick={() => navigate('/admin/knowledge-base')}>
          Back to Management
        </Button>
        <div className="flex gap-2">
           <Button 
            appearance="primary" 
            icon={<SaveRegular />} 
            onClick={handleSave}
            disabled={loading}
          >
            {isEdit ? 'Update Article' : 'Publish Article'}
          </Button>
        </div>
      </div>

      <PageHeader 
        title={isEdit ? `Edit: ${formData.title}` : 'New Knowledge Article'} 
        subtitle="Create high-quality documentation for OPSC staff and Ministries."
      />

      <div className={styles.editorGrid}>
        {/* Left: Editor */}
        <Card className={styles.pane}>
          <Field label="Article Title" required>
            <Input 
              value={formData.title} 
              onChange={handleTitleChange} 
              placeholder="e.g., Guide to Maternity Leave Policy"
            />
          </Field>

          <Field label="URL Slug (Permanent Link)" required hint="Used in the browser address bar.">
            <Input 
              value={formData.slug} 
              onChange={(e) => setFormData({...formData, slug: e.target.value})} 
              disabled={isEdit}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category" required>
              <select 
                className="p-2 rounded border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
              >
                <option value="">Select Category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </Field>
            
            <div className="flex flex-col gap-4 justify-end pb-1">
              <Switch 
                label="Published" 
                checked={formData.is_published} 
                onChange={(e) => setFormData({...formData, is_published: e.target.checked})}
              />
              <Switch 
                label="PSC Internal Only" 
                checked={formData.is_internal} 
                onChange={(e) => setFormData({...formData, is_internal: e.target.checked})}
              />
            </div>
          </div>

          <Divider />

          <Field label="Content (Markdown)" required className="flex-1">
            <Textarea 
              value={formData.content} 
              onChange={(e) => setFormData({...formData, content: e.target.value})}
              placeholder="# Heading 1\nType your documentation here..."
              style={{ minHeight: '400px', fontFamily: 'monospace' }}
            />
          </Field>
        </Card>

        {/* Right: Preview */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-2">
            <EyeRegular />
            <Text weight="semibold">Live Preview</Text>
          </div>
          <div className={styles.previewPane}>
             {formData.content ? (
                <div className={styles.markdownContent}>
                  <ReactMarkdown>{formData.content}</ReactMarkdown>
                </div>
             ) : (
               <div className="flex flex-col items-center justify-center h-full text-slate-400 italic">
                 <SparkleRegular fontSize={48} />
                 <Text>Start typing to see the preview...</Text>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
