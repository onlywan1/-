import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, BarChart3, Clock, Trash2, Coffee, Utensils, CupSoda, Sunrise, Sun, Moon } from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface HistoryItem {
  id: string;
  restaurantName: string;
  category: string;
  timestamp: any;
}

interface HistoryStatsProps {
  onClose: () => void;
}

export const HistoryStats: React.FC<HistoryStatsProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => {
    const localHistory = JSON.parse(localStorage.getItem('food_history') || '[]');
    
    if (!user) {
      // Use local history
      const items = localHistory.map((item: any, index: number) => ({
        id: `local-${index}`,
        ...item,
        timestamp: { toDate: () => new Date(item.timestamp) } // Mock Firestore timestamp
      }));
      processHistory(items);
      return;
    }

    const historyRef = collection(db, 'history');
    const q = query(
      historyRef,
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: HistoryItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as HistoryItem);
      });
      processHistory(items);
    });

    return () => unsubscribe();
  }, [user]);

  const processHistory = (items: HistoryItem[]) => {
    setHistory(items);
    
    // Calculate stats for the past week
    const lastWeek = subDays(new Date(), 7);
    const recentItems = items.filter(item => item.timestamp?.toDate() > lastWeek);
    
    const categoryCounts: Record<string, number> = {};
    recentItems.forEach(item => {
      const cat = item.category || '未知';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    
    const chartData = Object.keys(categoryCounts).map(key => ({
      name: key === 'breakfast' ? '早餐' : key === 'lunch' ? '中餐' : key === 'dinner' ? '晚餐' : key === 'coffee' ? '咖啡' : key === 'milktea' ? '奶茶' : key,
      count: categoryCounts[key]
    }));
    
    setStats(chartData);
  };

  const clearHistory = () => {
    if (window.confirm('确定要清空所有干饭记录吗？清空后无法恢复哦！')) {
      if (!user) {
        localStorage.removeItem('food_history');
        setHistory([]);
        setStats([]);
      } else {
        alert('云端记录暂不支持一键清空哦~');
      }
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'breakfast': return <Sunrise className="w-4 h-4 text-orange-500" />;
      case 'lunch': return <Sun className="w-4 h-4 text-orange-500" />;
      case 'dinner': return <Moon className="w-4 h-4 text-indigo-500" />;
      case 'coffee': return <Coffee className="w-4 h-4 text-amber-700" />;
      case 'milktea': return <CupSoda className="w-4 h-4 text-pink-500" />;
      default: return <Utensils className="w-4 h-4 text-orange-500" />;
    }
  };

  return (
    <motion.div 
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-full"
    >
      <Card className="border-orange-200 shadow-xl shadow-orange-100/50">
        <CardHeader className="text-center pb-2 relative">
          <Button variant="ghost" size="icon" className="absolute left-2 top-2 text-orange-600" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <CardTitle className="flex items-center justify-center gap-2">
            <BarChart3 className="h-6 w-6 text-orange-500" />
            干饭周报
          </CardTitle>
          <CardDescription>最近一周的干饭记录</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-6">
          
          {stats.length > 0 ? (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats}>
                  <XAxis dataKey="name" stroke="#f97316" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip cursor={{fill: '#fff7ed'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-4">
              暂无统计数据，快去抽一次吧！
            </div>
          )}

          <div className="border-t border-orange-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-orange-900 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                最近记录
              </h3>
              {history.length > 0 && !user && (
                <Button variant="ghost" size="sm" onClick={clearHistory} className="h-8 text-slate-400 hover:text-rose-500 hover:bg-rose-50 px-2">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> 清空
                </Button>
              )}
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {history.length === 0 ? (
                <div className="text-center py-6 bg-orange-50/50 rounded-xl border border-dashed border-orange-200">
                  <p className="text-sm text-slate-500">还没有记录哦，快去抽一次吧！</p>
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="flex justify-between items-center bg-orange-50/50 p-3 rounded-lg border border-orange-100/50 hover:bg-orange-100/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 bg-white p-1.5 rounded-full shadow-sm border border-orange-100">
                        {getCategoryIcon(item.category)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{item.restaurantName}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {item.timestamp ? format(item.timestamp.toDate(), 'MM月dd日 HH:mm', { locale: zhCN }) : '刚刚'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
