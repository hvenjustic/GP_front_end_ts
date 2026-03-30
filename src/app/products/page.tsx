import type { Metadata } from 'next';
import ProductsClient from './ProductsClient';

export const metadata: Metadata = {
  title: '商品中心 | 知识图谱电商'
};

export default function ProductsPage() {
  return <ProductsClient />;
}
