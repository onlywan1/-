import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Utensils, Navigation, RefreshCw, Star, DollarSign, Loader2, Coffee, ArrowLeft, Sunrise, Sun, Moon, CupSoda, Heart, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { wgs84togcj02 } from './lib/coord-transform';
import confetti from 'canvas-confetti';

interface Restaurant {
  id: string;
  name: string;
  type: string;
  location: string;
  address: string;
  distance: string;
  biz_ext: {
    rating?: string;
    cost?: string;
  };
  photos: any[];
}

type Category = 'breakfast' | 'lunch' | 'dinner' | 'coffee' | 'milktea';

const categoryLabels: Record<Category, string> = {
  breakfast: '早餐',
  lunch: '中餐',
  dinner: '晚餐',
  coffee: '咖啡',
  milktea: '奶茶'
};

export default function App() {
  const [status, setStatus] = useState<'idle' | 'sub_eat' | 'sub_drink' | 'locating' | 'fetching' | 'ready' | 'error' | 'favorites'>('idle');
  const [category, setCategory] = useState<Category>('lunch');
  const [errorMsg, setErrorMsg] = useState('');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinIndex, setSpinIndex] = useState(0);
  const spinIntervalRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playTick = () => {
    if (!audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      // Ignore audio errors
    }
  };

  const playSuccess = () => {
    if (!audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      // Ignore audio errors
    }
  };

  const [favorites, setFavorites] = useState<Restaurant[]>(() => {
    const saved = localStorage.getItem('favorites');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (restaurant: Restaurant) => {
    setFavorites(prev => {
      const exists = prev.some(r => r.id === restaurant.id);
      if (exists) {
        return prev.filter(r => r.id !== restaurant.id);
      } else {
        return [...prev, restaurant];
      }
    });
  };

  const fetchRestaurants = async (lat: number, lng: number, cat: Category) => {
    setStatus('fetching');
    try {
      const response = await fetch(`/api/restaurants?lat=${lat}&lng=${lng}&category=${cat}`);
      const data = await response.json();
      
      if (response.ok && data.pois && data.pois.length > 0) {
        setRestaurants(data.pois);
        setStatus('ready');
      } else {
        throw new Error(data.error || '附近没有找到合适的餐厅');
      }
    } catch (err: any) {
      setErrorMsg(err.message || '获取餐厅信息失败');
      setStatus('error');
    }
  };

  const handleGetLocation = (cat: Category) => {
    setCategory(cat);
    setStatus('locating');
    setErrorMsg('');
    if (!navigator.geolocation) {
      setErrorMsg('您的浏览器不支持地理位置功能');
      setStatus('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // Convert WGS84 (Browser) to GCJ02 (Amap)
        const [gcjLng, gcjLat] = wgs84togcj02(longitude, latitude);
        fetchRestaurants(gcjLat, gcjLng, cat);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setErrorMsg('无法获取您的位置，请确保已授权位置权限。');
        setStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleGoBack = () => {
    setStatus('idle');
    setSelected(null);
    setRestaurants([]);
    setIsSpinning(false);
  };

  const startSpinning = () => {
    if (restaurants.length === 0 || isSpinning) return;
    
    initAudio();
    setIsSpinning(true);
    setSelected(null);
    
    let speed = 50;
    let duration = 0;
    const maxDuration = 3000; // 3 seconds of spinning

    const spin = () => {
      setSpinIndex((prev) => (prev + 1) % restaurants.length);
      playTick();
      duration += speed;
      
      if (duration < maxDuration) {
        // Gradually slow down
        if (duration > maxDuration * 0.7) {
          speed += 20;
        }
        spinIntervalRef.current = window.setTimeout(spin, speed);
      } else {
        // Stop
        setIsSpinning(false);
        const finalIndex = Math.floor(Math.random() * restaurants.length);
        setSpinIndex(finalIndex);
        setSelected(restaurants[finalIndex]);
        playSuccess();
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f97316', '#ef4444', '#eab308', '#3b82f6'],
          zIndex: 100,
        });
      }
    };

    spin();
  };

  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) clearTimeout(spinIntervalRef.current);
    };
  }, []);

  const openInAmap = (restaurant: Restaurant) => {
    const [lng, lat] = restaurant.location.split(',');
    const url = `https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(restaurant.name)}`;
    window.open(url, '_blank');
  };

  const getTitle = () => {
    if (status === 'favorites') return '我的收藏';
    if (status === 'idle' || status === 'sub_eat' || status === 'sub_drink') return '今天吃/喝点啥？';
    if (['breakfast', 'lunch', 'dinner'].includes(category)) return `今天${categoryLabels[category]}吃什么？`;
    return `今天喝哪家${categoryLabels[category]}？`;
  };

  const currentReviews = useMemo(() => {
    if (!selected) return [];
    
    const ratingStr = selected.biz_ext?.rating;
    const rating = ratingStr && ratingStr !== '[]' ? parseFloat(ratingStr) : 4.5;
    const isGood = rating >= 4.0;

    const goodReviews = [
      "味道很不错，食材新鲜，强烈推荐！",
      "环境很好，服务态度也很热情，下次还会再来。",
      "性价比很高，分量足，吃得很饱。",
      "招牌绝了，排队也值得！",
      "经常来的一家店，品质一直很稳定。",
      "盲点都不踩雷，朋友们都很喜欢。",
      "出餐速度很快，包装也很用心。"
    ];

    const mixedReviews = [
      "味道还可以，就是上菜稍微有点慢。",
      "中规中矩吧，没有特别惊艳，随便吃吃还行。",
      "价格偏贵，分量一般，不过环境还算干净。",
      "有些偏咸，希望能改进一下。",
      "人太多了，等位等了很久，体验一般。"
    ];

    const reviews = [];
    const numReviews = Math.floor(Math.random() * 2) + 2; // 2 or 3 reviews
    
    // Use restaurant ID to seed the random so it's consistent for the same restaurant
    let seed = 0;
    for (let i = 0; i < selected.id.length; i++) {
      seed += selected.id.charCodeAt(i);
    }

    const random = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < numReviews; i++) {
      const pool = isGood ? goodReviews : (random() > 0.5 ? goodReviews : mixedReviews);
      const text = pool[Math.floor(random() * pool.length)];
      
      if (!reviews.find(r => r.text === text)) {
        reviews.push({
          id: i,
          author: `匿名用户${Math.floor(random() * 9000) + 1000}`,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${selected.id}${i}`,
          text: text,
          date: new Date(Date.now() - random() * 10000000000).toLocaleDateString('zh-CN'),
        });
      }
    }
    return reviews;
  }, [selected]);

  return (
    <div className="min-h-screen bg-orange-50 text-slate-900 font-sans selection:bg-orange-200">
      <div className="max-w-md mx-auto p-6 flex flex-col min-h-screen">
        
        <header className="text-center py-8">
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-flex items-center justify-center p-3 bg-orange-100 rounded-full mb-4 text-orange-600"
          >
            <Utensils size={32} />
          </motion.div>
          <motion.h1 
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold tracking-tight text-orange-950"
          >
            {getTitle()}
          </motion.h1>
          <motion.p 
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-orange-700/80 mt-2"
          >
            解决人生终极难题
          </motion.p>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center w-full">
          {status === 'idle' && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full"
            >
              <Card className="border-orange-200 shadow-orange-100/50 shadow-xl">
                <CardHeader className="text-center pb-2">
                  <CardTitle>请选择您的需求</CardTitle>
                  <CardDescription>第一步：选择大类</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 pt-4">
                  <Button 
                    size="lg" 
                    onClick={() => setStatus('sub_eat')}
                    className="flex flex-col gap-2 bg-orange-500 hover:bg-orange-600 text-white w-full rounded-2xl h-32 shadow-lg shadow-orange-500/20"
                  >
                    <Utensils className="h-8 w-8" />
                    <span className="text-lg">吃正餐</span>
                  </Button>
                  <Button 
                    size="lg" 
                    onClick={() => setStatus('sub_drink')}
                    className="flex flex-col gap-2 bg-blue-500 hover:bg-blue-600 text-white w-full rounded-2xl h-32 shadow-lg shadow-blue-500/20"
                  >
                    <Coffee className="h-8 w-8" />
                    <span className="text-lg">喝点啥</span>
                  </Button>
                  <Button 
                    size="lg" 
                    onClick={() => setStatus('favorites')}
                    className="col-span-2 flex flex-row gap-2 bg-rose-500 hover:bg-rose-600 text-white w-full rounded-2xl h-16 shadow-lg shadow-rose-500/20"
                  >
                    <Heart className="h-6 w-6" />
                    <span className="text-lg">我的收藏</span>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {status === 'favorites' && (
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="w-full"
            >
              <Card className="border-rose-200 shadow-rose-100/50 shadow-xl">
                <CardHeader className="text-center pb-2 relative">
                  <Button variant="ghost" size="icon" className="absolute left-2 top-2 text-rose-600" onClick={() => setStatus('idle')}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <CardTitle>我的收藏</CardTitle>
                  <CardDescription>您收藏的餐厅列表</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 pt-4 max-h-[60vh] overflow-y-auto">
                  {favorites.length === 0 ? (
                    <div className="text-center text-slate-500 py-8">
                      <Heart className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                      <p>暂无收藏餐厅</p>
                    </div>
                  ) : (
                    favorites.map(restaurant => (
                      <div key={restaurant.id} className="border border-slate-200 rounded-xl p-3 flex justify-between items-center bg-white">
                        <div className="flex-1 min-w-0 pr-2">
                          <h3 className="font-bold text-slate-800 truncate">{restaurant.name}</h3>
                          <p className="text-xs text-slate-500 truncate mt-1">{restaurant.address}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="icon" variant="outline" className="h-8 w-8 text-orange-500 border-orange-200 hover:bg-orange-50" onClick={() => openInAmap(restaurant)}>
                            <Navigation className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="outline" className="h-8 w-8 text-rose-500 border-rose-200 hover:bg-rose-50" onClick={() => toggleFavorite(restaurant)}>
                            <Heart className="h-4 w-4 fill-rose-500" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {status === 'sub_eat' && (
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="w-full"
            >
              <Card className="border-orange-200 shadow-orange-100/50 shadow-xl">
                <CardHeader className="text-center pb-2 relative">
                  <Button variant="ghost" size="icon" className="absolute left-2 top-2 text-orange-600" onClick={() => setStatus('idle')}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <CardTitle>吃正餐</CardTitle>
                  <CardDescription>选择您想吃的时段</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 pt-4">
                  <Button size="lg" onClick={() => handleGetLocation('breakfast')} className="bg-amber-500 hover:bg-amber-600 text-white h-16 text-lg rounded-xl">
                    <Sunrise className="mr-3 h-6 w-6" /> 早餐
                  </Button>
                  <Button size="lg" onClick={() => handleGetLocation('lunch')} className="bg-orange-500 hover:bg-orange-600 text-white h-16 text-lg rounded-xl">
                    <Sun className="mr-3 h-6 w-6" /> 中餐
                  </Button>
                  <Button size="lg" onClick={() => handleGetLocation('dinner')} className="bg-rose-500 hover:bg-rose-600 text-white h-16 text-lg rounded-xl">
                    <Moon className="mr-3 h-6 w-6" /> 晚餐
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {status === 'sub_drink' && (
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="w-full"
            >
              <Card className="border-blue-200 shadow-blue-100/50 shadow-xl">
                <CardHeader className="text-center pb-2 relative">
                  <Button variant="ghost" size="icon" className="absolute left-2 top-2 text-blue-600" onClick={() => setStatus('idle')}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <CardTitle>喝点啥</CardTitle>
                  <CardDescription>选择您想喝的饮品</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 pt-4">
                  <Button size="lg" onClick={() => handleGetLocation('coffee')} className="bg-stone-700 hover:bg-stone-800 text-white h-16 text-lg rounded-xl">
                    <Coffee className="mr-3 h-6 w-6" /> 咖啡
                  </Button>
                  <Button size="lg" onClick={() => handleGetLocation('milktea')} className="bg-sky-500 hover:bg-sky-600 text-white h-16 text-lg rounded-xl">
                    <CupSoda className="mr-3 h-6 w-6" /> 奶茶
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {(status === 'locating' || status === 'fetching') && (
            <div className="flex flex-col items-center justify-center space-y-4 text-orange-600">
              <Loader2 className="h-10 w-10 animate-spin" />
              <p className="font-medium animate-pulse">
                {status === 'locating' ? '正在获取您的位置...' : `正在搜寻附近的${categoryLabels[category]}...`}
              </p>
            </div>
          )}

          {status === 'error' && (
            <Card className="w-full border-red-200 bg-red-50">
              <CardContent className="pt-6 text-center">
                <p className="text-red-600 mb-4">{errorMsg}</p>
                <Button variant="outline" onClick={() => setStatus('idle')}>重试</Button>
              </CardContent>
            </Card>
          )}

          {status === 'ready' && (
            <div className="w-full space-y-8">
              {/* The Decision Wheel / Result Card */}
              <div className="relative">
                <AnimatePresence mode="wait">
                  {!selected ? (
                    <motion.div
                      key="wheel"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="w-full"
                    >
                      <Card className="border-orange-200 shadow-xl shadow-orange-100/50 overflow-hidden">
                        <CardContent className="p-10 flex flex-col items-center justify-center min-h-[240px] text-center bg-gradient-to-br from-orange-50 to-white">
                          {isSpinning ? (
                            <motion.div
                              key={spinIndex}
                              initial={{ y: 20, opacity: 0, filter: 'blur(4px)' }}
                              animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                              exit={{ y: -20, opacity: 0, filter: 'blur(4px)' }}
                              transition={{ duration: 0.1 }}
                              className="text-3xl font-bold text-orange-900"
                            >
                              {restaurants[spinIndex]?.name}
                            </motion.div>
                          ) : (
                            <div className="text-xl text-orange-800 font-medium">
                              已找到 {restaurants.length} 家{categoryLabels[category]}店<br/>准备好做决定了吗？
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, scale: 0.8, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', bounce: 0.5 }}
                      className="w-full"
                    >
                      <div className="relative shadow-2xl shadow-orange-500/20 rounded-2xl overflow-hidden">
                        {/* Top Section */}
                        <div className="bg-white p-6 pb-8 relative border-x border-t border-orange-200 rounded-t-2xl">
                          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-red-500"></div>
                          <div className="flex justify-between items-start">
                            <div>
                              <h2 className="text-2xl font-bold text-orange-950 mb-1">
                                {selected.name}
                              </h2>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {selected.type.split(';').slice(-2).map((t, i) => (
                                  <Badge key={i} variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-200">
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 -mt-1 -mr-1 shrink-0"
                              onClick={() => toggleFavorite(selected)}
                            >
                              <Heart className={`h-6 w-6 ${favorites.some(r => r.id === selected.id) ? 'fill-rose-500' : ''}`} />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Ticket Divider */}
                        <div className="relative h-8 bg-white border-x border-orange-200 flex items-center overflow-hidden">
                          <div className="absolute -left-4 w-8 h-8 bg-orange-50 rounded-full border border-orange-200 z-10"></div>
                          <div className="absolute -right-4 w-8 h-8 bg-orange-50 rounded-full border border-orange-200 z-10"></div>
                          <div className="w-full border-t-2 border-dashed border-orange-200 mx-4"></div>
                        </div>

                        {/* Bottom Section */}
                        <div className="bg-white p-6 pt-4 relative border-x border-b border-orange-200 rounded-b-2xl">
                          <div className="space-y-3 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                              <span className="truncate">{selected.address}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <Navigation className="w-4 h-4 text-orange-500" />
                                <span>距离 {selected.distance}m</span>
                              </div>
                              {selected.biz_ext?.rating && selected.biz_ext.rating !== '[]' && (
                                <div className="flex items-center gap-1">
                                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                  <span>{selected.biz_ext.rating}分</span>
                                </div>
                              )}
                              {selected.biz_ext?.cost && selected.biz_ext.cost !== '[]' && (
                                <div className="flex items-center gap-1">
                                  <DollarSign className="w-4 h-4 text-green-600" />
                                  <span>人均 ¥{selected.biz_ext.cost}</span>
                                </div>
                              )}
                            </div>

                            {/* Mock Reviews Section */}
                            <div className="mt-6 pt-4 border-t border-orange-100">
                              <h4 className="text-sm font-bold text-orange-900 mb-3 flex items-center gap-1">
                                <MessageSquare className="w-4 h-4" />
                                精选评价
                              </h4>
                              <div className="space-y-3">
                                {currentReviews.map((review, idx) => (
                                  <div key={idx} className="bg-orange-50/50 rounded-lg p-3 text-left">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                        <img src={review.avatar} alt="avatar" className="w-5 h-5 rounded-full bg-orange-200" />
                                        <span className="text-xs font-medium text-slate-700">{review.author}</span>
                                      </div>
                                      <span className="text-xs text-slate-400">{review.date}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed">{review.text}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="mt-6 flex gap-3">
                            <Button 
                              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-12 text-base"
                              onClick={() => openInAmap(selected)}
                            >
                              去这里{['breakfast', 'lunch', 'dinner'].includes(category) ? '吃' : '喝'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={handleGoBack}
                  disabled={isSpinning}
                  className="rounded-full px-8 h-14 text-lg w-full sm:w-auto border-orange-200 text-orange-700 hover:bg-orange-100"
                >
                  <ArrowLeft className="mr-2 h-5 w-5" />
                  返回重选
                </Button>
                <Button 
                  size="lg" 
                  onClick={startSpinning}
                  disabled={isSpinning}
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-8 h-14 text-lg shadow-xl shadow-slate-900/20 w-full sm:w-auto transition-transform active:scale-95"
                >
                  <RefreshCw className={`mr-2 h-5 w-5 ${isSpinning ? 'animate-spin' : ''}`} />
                  {selected ? '换一家' : '帮我选！'}
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
