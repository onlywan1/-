import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Route to fetch nearby restaurants from Amap
  app.get('/api/restaurants', async (req, res) => {
    const { lat, lng, radius = 2000, category = 'lunch' } = req.query;
    const apiKey = process.env.AMAP_API_KEY;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing latitude or longitude' });
    }

    let types = '050000';
    let keywords = '';
    
    switch(category) {
      case 'breakfast':
        types = '050000'; keywords = '早餐|早点|包子|粥|粉面'; break;
      case 'lunch':
        types = '050100|050200|050300'; keywords = '中餐|快餐|简餐|正餐'; break;
      case 'dinner':
        types = '050100|050200'; keywords = '晚餐|火锅|烧烤|正餐|海鲜'; break;
      case 'coffee':
        types = '050500'; keywords = '咖啡'; break;
      case 'milktea':
        types = '050900'; keywords = '奶茶|果茶|饮品'; break;
    }

    if (!apiKey) {
      // Fallback to mock data if API key is not configured (for preview purposes)
      console.warn('AMAP_API_KEY is missing. Returning mock data.');
      let mockPois = [];
      if (category === 'breakfast') {
        mockPois = [
          { id: 'b1', name: '放心早餐车', type: '餐饮服务;快餐厅;快餐厅', location: `${lng},${lat}`, address: '附近街角', distance: '50', biz_ext: { rating: '4.0', cost: '8.00' }, photos: [] },
          { id: 'b2', name: '永和豆浆', type: '餐饮服务;中餐厅;中餐厅', location: `${lng},${lat}`, address: '附近模拟地址', distance: '150', biz_ext: { rating: '4.2', cost: '15.00' }, photos: [] },
          { id: 'b3', name: '老街肠粉', type: '餐饮服务;中餐厅;中餐厅', location: `${lng},${lat}`, address: '附近模拟地址', distance: '200', biz_ext: { rating: '4.5', cost: '12.00' }, photos: [] },
        ];
      } else if (category === 'lunch') {
        mockPois = [
          { id: 'l1', name: '正宗兰州牛肉面', type: '餐饮服务;快餐厅;快餐厅', location: `${lng},${lat}`, address: '附近模拟地址5号', distance: '80', biz_ext: { rating: '4.0', cost: '25.00' }, photos: [] },
          { id: 'l2', name: '手工汉堡与精酿', type: '餐饮服务;快餐厅;西式快餐', location: `${lng},${lat}`, address: '附近模拟地址6号', distance: '620', biz_ext: { rating: '4.7', cost: '68.00' }, photos: [] },
          { id: 'l3', name: '隆江猪脚饭', type: '餐饮服务;快餐厅;中式快餐', location: `${lng},${lat}`, address: '附近模拟地址', distance: '120', biz_ext: { rating: '4.3', cost: '20.00' }, photos: [] },
        ];
      } else if (category === 'dinner') {
        mockPois = [
          { id: 'd1', name: '老北京柴火烤鸭', type: '餐饮服务;中餐厅;烤鸭店', location: `${lng},${lat}`, address: '附近模拟地址1号', distance: '120', biz_ext: { rating: '4.8', cost: '120.00' }, photos: [] },
          { id: 'd2', name: '川蜀麻辣火锅', type: '餐饮服务;中餐厅;火锅店', location: `${lng},${lat}`, address: '附近模拟地址2号', distance: '350', biz_ext: { rating: '4.5', cost: '95.00' }, photos: [] },
          { id: 'd3', name: '深夜居酒屋', type: '餐饮服务;外国餐厅;日本菜', location: `${lng},${lat}`, address: '附近模拟地址3号', distance: '500', biz_ext: { rating: '4.6', cost: '150.00' }, photos: [] },
        ];
      } else if (category === 'coffee') {
        mockPois = [
          { id: 'c1', name: '瑞幸咖啡', type: '餐饮服务;咖啡厅;咖啡厅', location: `${lng},${lat}`, address: '附近模拟地址7号', distance: '100', biz_ext: { rating: '4.3', cost: '15.00' }, photos: [] },
          { id: 'c2', name: '星巴克', type: '餐饮服务;咖啡厅;咖啡厅', location: `${lng},${lat}`, address: '附近模拟地址9号', distance: '400', biz_ext: { rating: '4.4', cost: '35.00' }, photos: [] },
          { id: 'c3', name: 'Manner Coffee', type: '餐饮服务;咖啡厅;咖啡厅', location: `${lng},${lat}`, address: '附近模拟地址', distance: '220', biz_ext: { rating: '4.7', cost: '20.00' }, photos: [] },
        ];
      } else if (category === 'milktea') {
        mockPois = [
          { id: 'm1', name: '喜茶 HEYTEA', type: '餐饮服务;冷饮店;奶茶店', location: `${lng},${lat}`, address: '附近模拟地址8号', distance: '250', biz_ext: { rating: '4.6', cost: '28.00' }, photos: [] },
          { id: 'm2', name: '蜜雪冰城', type: '餐饮服务;冷饮店;奶茶店', location: `${lng},${lat}`, address: '附近模拟地址10号', distance: '50', biz_ext: { rating: '4.1', cost: '8.00' }, photos: [] },
          { id: 'm3', name: '霸王茶姬', type: '餐饮服务;冷饮店;奶茶店', location: `${lng},${lat}`, address: '附近模拟地址', distance: '300', biz_ext: { rating: '4.5', cost: '22.00' }, photos: [] },
        ];
      }

      return res.json({
        status: '1',
        info: 'OK',
        mocked: true,
        pois: mockPois
      });
    }

    try {
      // Use specific types and keywords based on category
      const amapUrl = `https://restapi.amap.com/v3/place/around?key=${apiKey}&location=${lng},${lat}&types=${types}&keywords=${encodeURIComponent(keywords)}&radius=${radius}&offset=50&page=1&extensions=all`;
      
      const response = await fetch(amapUrl);
      const data = await response.json();
      
      if (data.status === '1') {
        res.json(data);
      } else {
        res.status(500).json({ error: 'Amap API Error', details: data.info });
      }
    } catch (error) {
      console.error('Error fetching from Amap:', error);
      res.status(500).json({ error: 'Failed to fetch data from Amap' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
