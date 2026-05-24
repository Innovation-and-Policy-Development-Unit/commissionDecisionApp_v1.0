import React, { useState, useEffect, useCallback } from 'react';
import { 
  Text, 
  Button, 
  Card, 
  CardHeader,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  TableSelectionCell,
  Input,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Field,
  Textarea,
  Switch,
  makeStyles,
  shorthands,
  tokens
} from '@fluentui/react-components';
import { 
  EditRegular, 
  DeleteRegular, 
  AddRegular, 
  FolderRegular, 
  DocumentRegular,
  SaveRegular,
  DismissRegular,
  EyeRegular
} from '@fluentui/react-icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
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
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  tableCard: {
    ...shorthands.padding('16px'),
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '16px',
  }
});

export default function KnowledgeBaseAdmin() {
  const styles = useStyles();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Category Modal State
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [currentCat, setCurrentCat] = useState(null);
  const [catForm, setCatForm] = useState({ title: '', description: '', icon_name: '', display_order: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, artRes] = await Promise.all([
        api.get('/knowledge/categories/'),
        api.get('/knowledge/articles/')
      ]);
      setCategories(catRes.data.results || catRes.data);
      setArticles(artRes.data.results || artRes.data);
    } catch (error) {
      console.error('Error fetching knowledge base data:', error);
      toast.error('Failed to load knowledge base data.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEditCategory = (cat) => {
    setCurrentCat(cat);
    setCatForm({ 
      title: cat.title, 
      description: cat.description || '', 
      icon_name: cat.icon_name || '', 
      display_order: cat.display_order || 0 
    });
    setCatModalOpen(true);
  };

  const handleAddCategory = () => {
    setCurrentCat(null);
    setCatForm({ title: '', description: '', icon_name: 'FolderRegular', display_order: categories.length });
    setCatModalOpen(true);
  };

  const saveCategory = async () => {
    try {
      if (currentCat) {
        await api.patch(`/knowledge/categories/${currentCat.id}/`, catForm);
        toast.success('Category updated.');
      } else {
        await api.post('/knowledge/categories/', catForm);
        toast.success('Category created.');
      }
      setCatModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to save category.');
    }
  };

  const deleteCategory = async (cat) => {
    const ok = await confirm({
      title: 'Delete Category',
      message: `Are you sure you want to delete "${cat.title}"? This will also delete all articles in this category.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await api.delete(`/knowledge/categories/${cat.id}/`);
      toast.success('Category deleted.');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete category.');
    }
  };

  const deleteArticle = async (art) => {
    const ok = await confirm({
      title: 'Delete Article',
      message: `Are you sure you want to delete "${art.title}"?`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await api.delete(`/knowledge/articles/${art.slug}/`);
      toast.success('Article deleted.');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete article.');
    }
  };

  return (
    <div className={styles.container}>
      <PageHeader 
        title="Knowledge Base Management" 
        subtitle="Manage official OPSC documentation, SOPs, and circulars."
      />

      {/* Categories Section */}
      <Card className={styles.tableCard}>
        <div className={styles.sectionHeader}>
          <div className="flex items-center gap-2">
            <FolderRegular fontSize={24} />
            <Text weight="bold" size={500}>Knowledge Categories</Text>
          </div>
          <Button icon={<AddRegular />} appearance="primary" onClick={handleAddCategory}>Add Category</Button>
        </div>
        
        <Table aria-label="Knowledge categories table">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Title</TableHeaderCell>
              <TableHeaderCell>Description</TableHeaderCell>
              <TableHeaderCell>Articles</TableHeaderCell>
              <TableHeaderCell>Order</TableHeaderCell>
              <TableHeaderCell style={{ width: '100px' }}>Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FolderRegular />
                    <Text weight="semibold">{cat.title}</Text>
                  </div>
                </TableCell>
                <TableCell>
                  <Text size={200} className="text-slate-500 truncate max-w-xs">{cat.description}</Text>
                </TableCell>
                <TableCell>{cat.article_count}</TableCell>
                <TableCell>{cat.display_order}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button appearance="subtle" icon={<EditRegular />} size="small" onClick={() => handleEditCategory(cat)} />
                    <Button appearance="subtle" icon={<DeleteRegular />} size="small" onClick={() => deleteCategory(cat)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Articles Section */}
      <Card className={styles.tableCard}>
        <div className={styles.sectionHeader}>
          <div className="flex items-center gap-2">
            <DocumentRegular fontSize={24} />
            <Text weight="bold" size={500}>Knowledge Articles</Text>
          </div>
          <Button 
            icon={<AddRegular />} 
            appearance="primary" 
            onClick={() => navigate('/admin/knowledge-base/new')}
            disabled={categories.length === 0}
          >
            Create Article
          </Button>
        </div>

        <Table aria-label="Knowledge articles table">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Title</TableHeaderCell>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell>Visibility</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Last Updated</TableHeaderCell>
              <TableHeaderCell style={{ width: '120px' }}>Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.map((art) => (
              <TableRow key={art.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <DocumentRegular />
                    <Text weight="semibold">{art.title}</Text>
                  </div>
                </TableCell>
                <TableCell>{art.category_title}</TableCell>
                <TableCell>
                  <Text size={200} className={art.is_internal ? "text-amber-600 font-medium" : "text-emerald-600 font-medium"}>
                    {art.is_internal ? 'PSC Internal' : 'Public/Ministry'}
                  </Text>
                </TableCell>
                <TableCell>
                   <Text size={200} className={art.is_published ? "text-emerald-600 font-bold" : "text-slate-400 italic"}>
                    {art.is_published ? 'Published' : 'Draft'}
                  </Text>
                </TableCell>
                <TableCell>{new Date(art.updated_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button appearance="subtle" icon={<EyeRegular />} size="small" onClick={() => navigate(`/wiki/${art.slug}`)} />
                    <Button appearance="subtle" icon={<EditRegular />} size="small" onClick={() => navigate(`/admin/knowledge-base/edit/${art.slug}`)} />
                    <Button appearance="subtle" icon={<DeleteRegular />} size="small" onClick={() => deleteArticle(art)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Category Modal */}
      <Dialog open={catModalOpen} onOpenChange={(e, data) => setCatModalOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{currentCat ? 'Edit Category' : 'Add Knowledge Category'}</DialogTitle>
            <DialogContent className={styles.dialogContent}>
              <Field label="Title" required>
                <Input value={catForm.title} onChange={(e) => setCatForm({...catForm, title: e.target.value})} />
              </Field>
              <Field label="Description">
                <Textarea value={catForm.description} onChange={(e) => setCatForm({...catForm, description: e.target.value})} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Icon Name">
                  <Input value={catForm.icon_name} onChange={(e) => setCatForm({...catForm, icon_name: e.target.value})} />
                </Field>
                <Field label="Display Order">
                  <Input type="number" value={catForm.display_order} onChange={(e) => setCatForm({...catForm, display_order: parseInt(e.target.value)})} />
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary" icon={<DismissRegular />}>Cancel</Button>
              </DialogTrigger>
              <Button appearance="primary" icon={<SaveRegular />} onClick={saveCategory}>Save Category</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
