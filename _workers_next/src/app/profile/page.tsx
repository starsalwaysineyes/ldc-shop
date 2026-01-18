import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { orders, loginUsers } from "@/lib/db/schema"
import { eq, desc, sql } from "drizzle-orm"
import { normalizeTimestampMs } from "@/lib/db/queries"
import { ProfileContent } from "@/components/profile-content"

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
    const session = await auth()
    
    if (!session?.user?.id) {
        redirect("/")
    }

    const userId = session.user.id

    // Get user points
    let userPoints = 0
    try {
        const userResult = await db.select({ points: loginUsers.points })
            .from(loginUsers)
            .where(eq(loginUsers.userId, userId))
            .limit(1)
        userPoints = userResult[0]?.points || 0
    } catch {
        userPoints = 0
    }

    // Get order statistics
    let orderStats = { total: 0, pending: 0, delivered: 0 }
    try {
        const statsResult = await db.select({
            total: sql<number>`count(*)`,
            pending: sql<number>`sum(case when ${orders.status} = 'pending' then 1 else 0 end)`,
            delivered: sql<number>`sum(case when ${orders.status} = 'delivered' then 1 else 0 end)`
        })
            .from(orders)
            .where(eq(orders.userId, userId))
        
        if (statsResult[0]) {
            orderStats = {
                total: Number(statsResult[0].total) || 0,
                pending: Number(statsResult[0].pending) || 0,
                delivered: Number(statsResult[0].delivered) || 0
            }
        }
    } catch {
        // Ignore errors
    }

    // Get recent orders (last 5)
    let recentOrders: Array<{
        orderId: string
        productName: string
        amount: string
        status: string | null
        createdAt: Date | null
    }> = []
    try {
        recentOrders = await db.select({
            orderId: orders.orderId,
            productName: orders.productName,
            amount: orders.amount,
            status: orders.status,
            createdAt: orders.createdAt
        })
            .from(orders)
            .where(eq(orders.userId, userId))
            .orderBy(desc(normalizeTimestampMs(orders.createdAt)))
            .limit(5)
    } catch {
        // Ignore errors
    }

    return (
        <ProfileContent
            user={{
                id: session.user.id,
                name: session.user.name || session.user.username || "User",
                username: session.user.username || null,
                avatar: session.user.avatar_url || null
            }}
            points={userPoints}
            orderStats={orderStats}
            recentOrders={recentOrders}
        />
    )
}
