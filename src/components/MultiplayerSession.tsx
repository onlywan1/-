import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { collection, doc, setDoc, onSnapshot, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Users, CheckCircle2, Copy } from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  type: string;
  location: string;
  address: string;
  distance: string;
  biz_ext: any;
  photos: any[];
}

interface Session {
  hostId: string;
  status: 'voting' | 'finished';
  candidates: Restaurant[];
  selectedRestaurantId?: string;
}

interface MultiplayerSessionProps {
  sessionId: string;
  onClose: () => void;
  onFinished: (restaurant: Restaurant) => void;
}

export const MultiplayerSession: React.FC<MultiplayerSessionProps> = ({ sessionId, onClose, onFinished }) => {
  const { user } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [votes, setVotes] = useState<Record<string, string>>({}); // userId -> restaurantId
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    const sessionRef = doc(db, 'sessions', sessionId);
    const unsubscribeSession = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Session;
        setSession(data);
        if (data.status === 'finished' && data.selectedRestaurantId) {
          const selected = data.candidates.find(c => c.id === data.selectedRestaurantId);
          if (selected) onFinished(selected);
        }
      }
    });

    const votesRef = collection(db, 'sessions', sessionId, 'votes');
    const unsubscribeVotes = onSnapshot(votesRef, (snapshot) => {
      const newVotes: Record<string, string> = {};
      snapshot.forEach(doc => {
        newVotes[doc.id] = doc.data().restaurantId;
        if (doc.id === user?.uid) {
          setHasVoted(true);
        }
      });
      setVotes(newVotes);
    });

    return () => {
      unsubscribeSession();
      unsubscribeVotes();
    };
  }, [sessionId, user, onFinished]);

  const handleVote = async (restaurantId: string) => {
    if (!user || hasVoted) return;
    try {
      await setDoc(doc(db, 'sessions', sessionId, 'votes', user.uid), {
        userId: user.uid,
        restaurantId,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error voting:", error);
    }
  };

  const finishVoting = async () => {
    if (!user || session?.hostId !== user.uid) return;
    
    // Tally votes
    const counts: Record<string, number> = {};
    Object.values(votes).forEach(rid => {
      const restaurantId = rid as string;
      counts[restaurantId] = (counts[restaurantId] || 0) + 1;
    });
    
    let maxVotes = -1;
    let winnerId = session.candidates[0].id;
    
    Object.entries(counts).forEach(([rid, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        winnerId = rid;
      }
    });

    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'finished',
        selectedRestaurantId: winnerId
      });
    } catch (error) {
      console.error("Error finishing session:", error);
    }
  };

  const copyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionId);
    navigator.clipboard.writeText(url.toString());
    alert('链接已复制，快去分享给朋友吧！');
  };

  if (!session) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const isHost = user?.uid === session.hostId;

  return (
    <Card className="w-full border-orange-200 shadow-xl shadow-orange-100/50">
      <CardHeader className="text-center pb-2">
        <CardTitle className="flex items-center justify-center gap-2">
          <Users className="h-6 w-6 text-orange-500" />
          多人投票模式
        </CardTitle>
        <CardDescription>
          {session.status === 'voting' ? '大家正在投票中...' : '投票已结束！'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {session.status === 'voting' && (
          <div className="flex justify-center mb-4">
            <Button variant="outline" onClick={copyLink} className="text-orange-600 border-orange-200 hover:bg-orange-50">
              <Copy className="mr-2 h-4 w-4" /> 复制邀请链接
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {session.candidates.map(restaurant => {
            const voteCount = Object.values(votes).filter(id => id === restaurant.id).length;
            const isMyVote = votes[user?.uid || ''] === restaurant.id;

            return (
              <div key={restaurant.id} className="border border-slate-200 rounded-xl p-3 bg-white relative overflow-hidden">
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-orange-100 transition-all duration-500"
                  style={{ width: `${Object.keys(votes).length > 0 ? (voteCount / Object.keys(votes).length) * 100 : 0}%`, zIndex: 0 }}
                />
                <div className="relative z-10 flex justify-between items-center">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="font-bold text-slate-800 truncate flex items-center gap-2">
                      {restaurant.name}
                      {isMyVote && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </h3>
                    <p className="text-xs text-slate-500 truncate mt-1">{restaurant.address}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-medium text-slate-600">{voteCount} 票</span>
                    {session.status === 'voting' && !hasVoted && (
                      <Button size="sm" onClick={() => handleVote(restaurant.id)} className="bg-orange-500 hover:bg-orange-600 text-white">
                        投票
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {isHost && session.status === 'voting' && (
          <Button onClick={finishVoting} className="w-full mt-4 bg-slate-900 hover:bg-slate-800 text-white">
            结束投票并查看结果
          </Button>
        )}
        
        <Button variant="ghost" onClick={onClose} className="w-full mt-2">
          退出房间
        </Button>
      </CardContent>
    </Card>
  );
};
