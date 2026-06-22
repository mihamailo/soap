import { type ChangeEvent, type FormEvent, useState } from 'react';
import {
  Droplets,
  Flower2,
  Gift,
  Leaf,
  PackageCheck,
  Play,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sprout,
} from 'lucide-react';

type LeadFormData = {
  name: string;
  phone: string;
  product: string;
  message: string;
};

type LeadStatus = 'idle' | 'sending' | 'success' | 'error';

const initialLeadFormData: LeadFormData = {
  name: '',
  phone: '+7',
  product: 'Подарочный набор',
  message: '',
};

async function sendContactForm(data: LeadFormData) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  console.log(supabaseUrl)

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('supabase_config_missing');
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/send-contact-form`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      ...data,
      source: window.location.href,
    }),
  });

  if (!response.ok) {
    throw new Error('contact_form_failed');
  }
}

const benefits = [
  {
    icon: Leaf,
    title: 'Натуральный состав',
    text: 'Только природные ингредиенты без вредных добавок',
  },
  {
    icon: Droplets,
    title: 'Бережный уход',
    text: 'Увлажняет и питает кожу, не вызывает сухости',
  },
  {
    icon: Flower2,
    title: 'Премиум качество',
    text: 'Ручная работа и контроль на каждом этапе',
  },
  {
    icon: Gift,
    title: 'Эстетика и роскошь',
    text: 'Стильный дизайн и насыщенные ароматы для удовольствия',
  },
];

const products = [
  {
    title: 'Угольное детокс',
    text: 'Глубокое очищение и детокс для жирной и проблемной кожи',
    className: 'charcoal',
  },
  {
    title: 'Кофейный скраб',
    text: 'Мягкое отшелушивание и тонус для вашей кожи',
    className: 'coffee',
  },
  {
    title: 'Шелковый уход',
    text: 'Нежность и увлажнение для чувствительной кожи',
    className: 'silk',
  },
  {
    title: 'Мятная свежесть',
    text: 'Освежает и тонизирует, дарит ощущение чистоты',
    className: 'mint',
  },
];

const assurances = [
  { icon: Sprout, label: 'Натуральные ингредиенты' },
  { icon: ShieldCheck, label: 'Без сульфатов и парабенов' },
  { icon: PackageCheck, label: 'Не тестируется на животных' },
];

function App() {
  const [leadFormData, setLeadFormData] = useState<LeadFormData>(initialLeadFormData);
  const [leadStatus, setLeadStatus] = useState<LeadStatus>('idle');

  function handleLeadChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;

    setLeadFormData((current) => ({
      ...current,
      [name]: value,
    }));

    if (leadStatus !== 'idle') {
      setLeadStatus('idle');
    }
  }

  async function handleLeadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!leadFormData.name.trim() || leadFormData.phone.replace(/\D/g, '').length < 10) {
      setLeadStatus('error');
      return;
    }

    setLeadStatus('sending');

    try {
      await sendContactForm(leadFormData);
      setLeadFormData(initialLeadFormData);
      setLeadStatus('success');
    } catch (error) {
      console.error('Error sending form:', error);
      setLeadStatus('error');
    }
  }

  return (
    <main className="page">
      <header className="header" aria-label="Главная навигация">
        <a className="brand" href="#">
          <span className="brandMark" aria-hidden="true">
            <Leaf size={23} strokeWidth={1.7} />
          </span>
          <span>
            <span className="brandName">Luxe Soap</span>
            <span className="brandSub">натуральное мыло</span>
          </span>
        </a>

        <nav className="nav">
          <a href="#about">О мыле</a>
          <a href="#benefits">Преимущества</a>
          <a href="#catalog">Ассортимент</a>
          <a href="#formula">Состав</a>
          <a href="#reviews">Отзывы</a>
          <a href="#contacts">Контакты</a>
        </nav>

        <a className="orderLink" href="#order">
          Заказать
        </a>
      </header>

      <section className="hero" id="about">
        <div className="heroImage" aria-hidden="true" />
        <div className="heroShade" aria-hidden="true" />
        <div className="heroContent">
          <p className="eyebrow">натуральное мыло ручной работы</p>
          <h1>Такой темный богатый цвет</h1>
          <span className="goldLine" aria-hidden="true" />
          <p className="accent">Там не много же</p>
          <p className="heroLead">Черный фон какой нить богатый черный такой</p>
          <p className="accent">Ну и надпись богатую</p>
          <p className="heroLead short">Всё богатое</p>

          <div className="heroActions">
            <a className="primaryBtn" href="#catalog">
              <ShoppingBag size={18} />
              Выбрать мыло
            </a>
            <button className="videoBtn" type="button" aria-label="Смотреть видео">
              <span>
                <Play size={17} fill="currentColor" />
              </span>
              Смотреть видео
            </button>
          </div>
        </div>
      </section>

      <section className="benefits" id="benefits" aria-label="Преимущества">
        {benefits.map(({ icon: Icon, title, text }) => (
          <article className="benefit" key={title}>
            <Icon size={39} strokeWidth={1.45} />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className="catalog" id="catalog">
        <div className="sectionTitle">
          <h2>Ассортимент</h2>
          <span>
            <Sparkles size={18} />
          </span>
        </div>

        <div className="productGrid">
          {products.map((product) => (
            <article className="productCard" key={product.title}>
              <div className={`productVisual ${product.className}`} aria-hidden="true" />
              <div className="productBody">
                <h3>{product.title}</h3>
                <p>{product.text}</p>
                <div className="productFooter">
                  <strong>590 ₽</strong>
                  <button type="button">
                    <ShoppingBag size={16} />
                    В корзину
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <a className="outlineBtn" href="#order">
          Смотреть весь ассортимент
        </a>
      </section>

      <section className="story" id="formula">
        <div className="storyCopy">
          <h2>Роскошь в каждом куске мыла</h2>
          <span className="goldLine small" aria-hidden="true" />
          <p>
            Наше мыло - это сочетание природы и науки. Мы создаём его вручную
            из лучших ингредиентов, чтобы ваша кожа получала только лучшее.
          </p>
          <div className="assurances">
            {assurances.map(({ icon: Icon, label }) => (
              <span key={label}>
                <Icon size={28} strokeWidth={1.45} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="giftCta" id="order">
        <div className="giftIcon" aria-hidden="true">
          <Gift size={42} strokeWidth={1.4} />
        </div>
        <div>
          <h2>Подарите себе и близким натуральную роскошь</h2>
          <p>Быстрая доставка и красивая упаковка в подарок</p>
        </div>
        <form className="leadForm" onSubmit={handleLeadSubmit}>
          <label>
            <span>Имя</span>
            <input name="name" type="text" autoComplete="name" value={leadFormData.name} onChange={handleLeadChange} required />
          </label>
          <label>
            <span>Телефон</span>
            <input name="phone" type="tel" autoComplete="tel" value={leadFormData.phone} onChange={handleLeadChange} required />
          </label>
          <label className="leadWide">
            <span>Что интересно</span>
            <select name="product" value={leadFormData.product} onChange={handleLeadChange}>
              <option>Подарочный набор</option>
              <option>Угольное мыло</option>
              <option>Кофейный скраб</option>
              <option>Шелковый уход</option>
              <option>Мятная свежесть</option>
            </select>
          </label>
          <label className="leadWide">
            <span>Комментарий</span>
            <textarea
              name="message"
              rows={3}
              placeholder="Удобное время для звонка или пожелания"
              value={leadFormData.message}
              onChange={handleLeadChange}
            />
          </label>
          <button className="primaryBtn leadSubmit" type="submit" disabled={leadStatus === 'sending'}>
            <ShoppingBag size={18} />
            {leadStatus === 'sending' ? 'Отправка...' : 'Оставить заявку'}
          </button>
          <p className={`leadStatus ${leadStatus}`} role="status">
            {leadStatus === 'success' && 'Заявка отправлена. Мы скоро свяжемся.'}
            {leadStatus === 'error' && 'Проверьте имя и телефон или попробуйте отправить позже.'}
          </p>
        </form>
      </section>
    </main>
  );
}

export default App;
