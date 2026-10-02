import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero__geometry" aria-hidden="true">
        <svg className="landing-hero__polygon landing-hero__polygon--back" viewBox="0 0 1494 577" preserveAspectRatio="none"><path d="M1494 0V577H0Z" fill="#450000" /></svg>
        <svg className="landing-hero__polygon landing-hero__polygon--middle" viewBox="0 0 1494 483" preserveAspectRatio="none"><path d="M1494 0V483H0Z" fill="#8c0d22" /></svg>
        <svg className="landing-hero__polygon landing-hero__polygon--front" viewBox="0 0 1494 377" preserveAspectRatio="none"><path d="M1494 0V377H0Z" fill="#b20e2c" /></svg>
      </div>
      <div className="landing-hero__content">
        <h1 id="landing-title" className="landing-hero__title">
          <span>работа</span>
          <span>находит</span>
          <span><em>тебя</em>.</span>
        </h1>
        <p className="landing-hero__description">Проверенные IT-специалисты<br />и квалифицированные работодатели</p>
        <div className="landing-hero__actions">
          <Link className="button landing-hero__cta" href="/register?role=EMPLOYER">Я работодатель <span aria-hidden="true">→</span></Link>
          <Link className="button secondary landing-hero__cta" href="/register?role=SPECIALIST">Я специалист</Link>
        </div>
      </div>
      <div className="landing-hero__mascot" aria-hidden="true">
        <Image src="/poza 1.png" width={1086} height={1448} sizes="(max-width: 600px) 70vw, (max-width: 1100px) 55vw, 650px" alt="" priority />
      </div>
    </section>
  );
}
