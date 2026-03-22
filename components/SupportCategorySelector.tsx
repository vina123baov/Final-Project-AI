'use client'

import { SUPPORT_CATEGORIES } from '@/lib/constants'

interface SupportCategorySelectorProps {
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function SupportCategorySelector({
  selected,
  onChange,
}: SupportCategorySelectorProps) {
  const toggleCategory = (categoryId: string) => {
    if (selected.includes(categoryId)) {
      onChange(selected.filter(id => id !== categoryId))
    } else {
      onChange([...selected, categoryId])
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-foreground block mb-3">
          Các loại tiếp tế cần hỗ trợ
        </label>
        <p className="text-xs text-muted-foreground mb-4">
          Chọn các loại tiếp tế mà gia đình cần hỗ trợ
        </p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {SUPPORT_CATEGORIES.map(category => (
          <button
            key={category.id}
            onClick={() => toggleCategory(category.id)}
            className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition ${
              selected.includes(category.id)
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/50'
            }`}
            title={category.description}
          >
            <span className="text-3xl mb-2">{category.icon}</span>
            <span className="text-xs font-semibold text-foreground text-center">
              {category.name}
            </span>
          </button>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="text-sm text-foreground font-medium">
            Đã chọn {selected.length} loại tiếp tế
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {selected.map(id => {
              const cat = SUPPORT_CATEGORIES.find(c => c.id === id)
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs"
                >
                  {cat?.icon} {cat?.name}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
