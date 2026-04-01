import type { Metadata } from 'next';
import ProductsClient from './ProductsClient';

export const metadata: Metadata = {
  title: '商品中心 | 网站信息知识图谱'
};

export default function ProductsPage() {
  return <ProductsClient />;
}
