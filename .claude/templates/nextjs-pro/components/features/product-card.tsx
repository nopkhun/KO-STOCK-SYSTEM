'use client'

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Product } from '@/types'
import { formatCurrency } from '@/lib/utils'

interface ProductCardProps {
  product: Product
  onEdit?: (product: Product) => void
  onDelete?: (id: string) => void
}

export function ProductCard({ product, onEdit, onDelete }: ProductCardProps) {
  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      {/* Product Image */}
      <div className="aspect-square bg-muted flex items-center justify-center">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-4xl text-muted-foreground/30">
            {product.name.charAt(0)}
          </span>
        )}
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base line-clamp-1">{product.name}</CardTitle>
          <Badge variant={product.isActive ? 'default' : 'secondary'}>
            {product.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {product.description}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-lg font-semibold">
            {formatCurrency(product.price)}
          </span>
          <span className="text-sm text-muted-foreground">
            คลัง: {product.stock}
          </span>
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(product)}
          >
            แก้ไข
          </Button>
        )}
        {onDelete && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive hover:text-destructive"
            onClick={() => onDelete(product.id)}
          >
            ลบ
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

// ==========================================
// Skeleton for loading state
// ==========================================

export function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-square bg-muted animate-pulse" />
      <CardHeader className="pb-2">
        <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent className="pb-2">
        <div className="space-y-2">
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
          <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
        </div>
        <div className="mt-2 flex justify-between">
          <div className="h-6 w-20 bg-muted animate-pulse rounded" />
          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <div className="h-9 flex-1 bg-muted animate-pulse rounded" />
        <div className="h-9 flex-1 bg-muted animate-pulse rounded" />
      </CardFooter>
    </Card>
  )
}
