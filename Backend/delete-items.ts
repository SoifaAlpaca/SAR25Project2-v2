import mongoose from 'mongoose';
import Item from './src/models/item'; // caminho para o teu modelo

async function deleteAllItems() {
    await mongoose.connect('mongodb://127.0.0.1:27017/local'); // ou a tua DB
    await Item.deleteMany({});
    console.log('Todos os itens foram apagados.');
    await mongoose.disconnect();
}

deleteAllItems();

//npx ts-node delete-items.ts

