import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Quote, Heading2, Heading3, Link as LinkIcon, Image as ImageIcon, Undo, Redo, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Image.configure({ inline: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Inizia a scrivere il tuo articolo...',
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'min-h-[400px] focus:outline-none blog-editor-content',
      },
    },
  })

  // Sync content quando value cambia dall'esterno (es. caricamento iniziale)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor])

  if (!editor) return <div className="h-[400px] surface" />

  async function handleImageUpload() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const ext = file.name.split('.').pop() ?? 'jpg'
      const { data: me } = await supabase.auth.getUser()
      if (!me.user) return
      const path = `${me.user.id}/${Date.now()}.${ext}`
      const up = await supabase.storage.from('blog-media').upload(path, file, { cacheControl: '3600', upsert: false })
      if (up.error) { toast.error('Upload fallito: ' + up.error.message); return }
      const { data: pub } = supabase.storage.from('blog-media').getPublicUrl(path)
      editor!.chain().focus().setImage({ src: pub.publicUrl }).run()
    }
    input.click()
  }

  function setLink() {
    const url = window.prompt('URL del link')
    if (url === null) return
    if (url === '') {
      editor!.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    const href = /^https?:\/\//.test(url) ? url : `https://${url}`
    editor!.chain().focus().extendMarkRange('link').setLink({ href }).run()
  }

  return (
    <div className="surface overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap p-2 border-b sticky top-0 z-10"
        style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
        <ToolBtn active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          icon={Heading2} label="H2" />
        <ToolBtn active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          icon={Heading3} label="H3" />
        <Sep />
        <ToolBtn active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          icon={Bold} label="Bold" />
        <ToolBtn active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          icon={Italic} label="Italic" />
        <Sep />
        <ToolBtn active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          icon={List} label="Bullet list" />
        <ToolBtn active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          icon={ListOrdered} label="Ordered list" />
        <ToolBtn active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          icon={Quote} label="Quote" />
        <ToolBtn active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          icon={Minus} label="Divider" />
        <Sep />
        <ToolBtn active={editor.isActive('link')} onClick={setLink} icon={LinkIcon} label="Link" />
        <ToolBtn active={false} onClick={handleImageUpload} icon={ImageIcon} label="Immagine" />
        <Sep />
        <ToolBtn active={false} onClick={() => editor.chain().focus().undo().run()} icon={Undo} label="Undo" />
        <ToolBtn active={false} onClick={() => editor.chain().focus().redo().run()} icon={Redo} label="Redo" />
      </div>

      {/* Editor */}
      <div className="p-6 sm:p-8">
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .blog-editor-content { font-size: 17px; line-height: 1.75; color: rgb(var(--fg)); }
        .blog-editor-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left; color: rgb(var(--fg-subtle)); pointer-events: none; height: 0;
        }
        .blog-editor-content h2 { font-family: var(--font-display); font-size: 1.8rem; line-height: 1.2; margin: 1.5rem 0 0.8rem; }
        .blog-editor-content h3 { font-family: var(--font-display); font-size: 1.4rem; line-height: 1.25; margin: 1.3rem 0 0.6rem; }
        .blog-editor-content p { margin: 0 0 1rem; }
        .blog-editor-content a { color: rgb(var(--gold-600)); text-decoration: underline; }
        .blog-editor-content ul, .blog-editor-content ol { margin: 0 0 1rem 1.5rem; }
        .blog-editor-content ul { list-style: disc; }
        .blog-editor-content ol { list-style: decimal; }
        .blog-editor-content blockquote { border-left: 3px solid rgb(var(--gold-500)); padding: 0.4rem 1.2rem; margin: 1.2rem 0; font-style: italic; color: rgb(var(--fg-muted)); }
        .blog-editor-content img { border-radius: 12px; margin: 1.2rem 0; max-width: 100%; }
        .blog-editor-content hr { border: none; border-top: 1px solid rgb(var(--border)); margin: 1.5rem 0; }
        .blog-editor-content strong { font-weight: 600; }
      `}</style>
    </div>
  )
}

function ToolBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Bold; label: string }) {
  return (
    <button type="button" onClick={onClick} title={label}
      className="inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors text-sm"
      style={{
        background: active ? 'rgb(var(--fg))' : 'transparent',
        color: active ? 'rgb(var(--bg-elev))' : 'rgb(var(--fg-muted))',
      }}>
      <Icon size={15} />
    </button>
  )
}

function Sep() {
  return <span className="w-px h-5 mx-1" style={{ background: 'rgb(var(--border))' }} />
}
