import React, { useState, useEffect, useCallback } from 'react';
import { 
  Text, 
  Card, 
  CardHeader,
  Input,
  makeStyles,
  shorthands,
  tokens,
  Divider,
  Badge,
  Button
} from '@fluentui/react-components';
import { 
  SearchRegular, 
  BookOpenRegular, 
  FolderRegular, 
  ChevronRightRegular,
  InfoRegular,
  LockClosedRegular,
  SparkleRegular
} from '@fluentui/react-icons';
import { useNavigate } from 'react-router-dom';
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
  searchBox: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.padding('24px'),
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    boxShadow: tokens.shadow8,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    columnGap: '24px',
    rowGap: '24px',
  },
  categoryCard: {
    cursor: 'pointer',
    transition: 'transform 0.2s ease-in-out',
    ':hover': {
      transform: 'translateY(-4px)',
      boxShadow: tokens.shadow16,
    }
  },
  articleItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '12px',
    paddingBottom: '12px',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    ...shorthands.padding('8px', '12px'),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  }
});

export default function KnowledgeBaseBrowse() {
  const styles = useStyles();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, artRes] = await Promise.all([
        api.get('/knowledge/categories/'),
        api.get('/knowledge/articles/')
      ]);
      setCategories(catRes.data.results || catRes.data);
      setArticles(artRes.data.results || artRes.data);
    } catch (error) {
      console.error('KB Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredArticles = articles.filter(a => 
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.category_title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <PageHeader 
        title="OPSC Wiki & Knowledge Base" 
        subtitle="Access official Standard Operating Procedures, Public Service Acts, and Circulars."
      />

      <div className={styles.searchBox}>
        <Input 
          size="large"
          placeholder="Search for policies, circulars, or help guides..."
          contentBefore={<SearchRegular />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full"
        />
      </div>

      {search ? (
        <div className="space-y-4">
          <Text weight="semibold" size={400}>Search Results ({filteredArticles.length})</Text>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredArticles.map(art => (
              <div 
                key={art.id} 
                className={styles.articleItem}
                onClick={() => navigate(`/wiki/${art.slug}`)}
              >
                <div className="flex items-center gap-3">
                  <BookOpenRegular />
                  <div>
                    <Text weight="semibold">{art.title}</Text>
                    <div className="flex items-center gap-2">
                       <Text size={100} className="text-slate-400 uppercase tracking-tight">{art.category_title}</Text>
                       {art.is_internal && <Badge size="small" appearance="outline" icon={<LockClosedRegular />}>Internal</Badge>}
                    </div>
                  </div>
                </div>
                <ChevronRightRegular className="text-slate-300" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.grid}>
          {categories.map(cat => {
            const catArticles = articles.filter(a => a.category === cat.id).slice(0, 5);
            if (catArticles.length === 0) return null;

            return (
              <Card key={cat.id} className={styles.categoryCard}>
                <CardHeader 
                  header={
                    <div className="flex items-center gap-2">
                      <FolderRegular fontSize={24} primaryFill={tokens.colorBrandForeground1} />
                      <Text weight="bold" size={500}>{cat.title}</Text>
                    </div>
                  }
                  description={<Text size={200}>{cat.description}</Text>}
                />
                
                <div className="mt-4 space-y-1">
                  {catArticles.map(art => (
                    <div 
                      key={art.id} 
                      className={styles.articleItem}
                      onClick={() => navigate(`/wiki/${art.slug}`)}
                    >
                      <Text size={200} className="truncate">{art.title}</Text>
                      {art.is_internal && <LockClosedRegular fontSize={14} className="text-amber-500 shrink-0" />}
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button 
                    appearance="subtle" 
                    size="small" 
                    icon={<ChevronRightRegular />} 
                    iconPosition="after"
                  >
                    View all {cat.article_count} articles
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* AI Assistant Tip */}
      <Card appearance="subtle" className="bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/50 mt-8">
        <div className="flex items-center gap-4 p-2">
          <SparkleRegular fontSize={32} primaryFill={tokens.colorBrandForeground1} />
          <div>
            <Text weight="bold">Pro Tip: Ask the Staff Assistant</Text>
            <Text block size={200} className="text-slate-600 dark:text-slate-400">
              The AI Assistant has read all these documents. You can ask it direct questions like "What is the policy for study leave?" to get instant answers with citations.
            </Text>
          </div>
        </div>
      </Card>
    </div>
  );
}
