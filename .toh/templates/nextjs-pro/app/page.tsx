import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// Mock stats data (Thai)
const stats = [
  { label: 'ผู้ใช้งานทั้งหมด', value: '2,847', change: '+12.5%', trend: 'up' },
  { label: 'รายได้เดือนนี้', value: '฿284,500', change: '+8.2%', trend: 'up' },
  { label: 'ออเดอร์ใหม่', value: '156', change: '-2.4%', trend: 'down' },
  { label: 'อัตราการแปลง', value: '3.24%', change: '+0.8%', trend: 'up' },
]

// Mock recent items (Thai)
const recentItems = [
  { id: 1, name: 'สินค้า A', status: 'active', price: 1250, date: '2 ชม. ที่แล้ว' },
  { id: 2, name: 'สินค้า B', status: 'pending', price: 890, date: '5 ชม. ที่แล้ว' },
  { id: 3, name: 'สินค้า C', status: 'active', price: 2100, date: 'เมื่อวาน' },
  { id: 4, name: 'สินค้า D', status: 'inactive', price: 450, date: '2 วันที่แล้ว' },
]

export default function HomePage() {
  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            ภาพรวมข้อมูลและสถิติสำคัญ
          </p>
        </div>
        <Button>เพิ่มรายการใหม่</Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className={`text-sm ${
                stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.change}
              </span>
              <span className="text-sm text-muted-foreground ml-1">
                จากเดือนที่แล้ว
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Items */}
      <Card>
        <CardHeader>
          <CardTitle>รายการล่าสุด</CardTitle>
          <CardDescription>สินค้าที่เพิ่มหรืออัพเดทล่าสุด</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentItems.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <span className="text-sm font-medium text-muted-foreground">
                      {item.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={
                    item.status === 'active' ? 'default' : 
                    item.status === 'pending' ? 'secondary' : 'outline'
                  }>
                    {item.status === 'active' ? 'ใช้งาน' : 
                     item.status === 'pending' ? 'รอดำเนินการ' : 'ไม่ใช้งาน'}
                  </Badge>
                  <span className="font-medium text-sm">
                    ฿{item.price.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
