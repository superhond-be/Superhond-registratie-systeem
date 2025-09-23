import express from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

app.post('/api/klanten', (req,res)=>{
  console.log('Ontvangen payload:', req.body);
  res.json({ status:'ok', ontvangen:req.body });
});

const port = process.env.PORT || 3000;
app.listen(port, ()=> console.log('Superhond mock API actief op poort', port));
