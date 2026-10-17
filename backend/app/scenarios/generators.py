"""Code generators for document scenarios (spec §5).

Documents, defects and answer keys are built by code from parameters, so the answer key is correct by
construction; the LLM only writes the legend. Each generator returns documents, answer_key, checks,
incidents and the answer form for the run.
"""

import random
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from app.scenarios.spec import AnswerItem, Check, DocMutation, Document, Incident

COMPANIES = [
    "ООО «Сибирский поставщик»",
    "АО «Байкал-Снаб»",
    "ООО «Ангара-Трейд»",
    "ООО «Кедр»",
    "АО «Восток-Логистик»",
    "ООО «Иркутская торговая компания»",
    "ООО «Прибайкалье»",
]
BUYERS = ["ООО «Учебный центр»", "АО «Северные сети»", "ООО «Городская клиника»", "МБУ «Центр обслуживания»"]
GOODS = [
    ("Ноутбук", "шт.", 64900),
    ('Монитор 24"', "шт.", 15800),
    ("Клавиатура", "шт.", 1450),
    ("Мышь оптическая", "шт.", 690),
    ("Принтер лазерный", "шт.", 21300),
    ("Картридж", "шт.", 3200),
    ("Кабель витая пара, 305 м", "бухта", 7900),
    ("Источник бесперебойного питания", "шт.", 11200),
    ("Стул офисный", "шт.", 5600),
    ("Бумага А4, 500 л.", "пачка", 420),
]


def _money(x: Decimal) -> str:
    q = x.quantize(Decimal("0.01"), ROUND_HALF_UP)
    whole, frac = f"{q:.2f}".split(".")
    groups: list[str] = []
    while whole:
        groups.insert(0, whole[-3:])
        whole = whole[:-3]
    return " ".join(groups) + "," + frac


def _d(x: float | int | str | Decimal) -> Decimal:
    return Decimal(str(x))


@dataclass
class Generated:
    documents: list[Document]
    answer_key: list[AnswerItem]
    checks: list[Check]
    incidents: list[Incident]
    answer_form: dict[str, Any]
    defect_catalog: dict[str, str]
    params: dict[str, Any]


LEGAL_DEFECTS = {
    "deadline_mismatch": "Несогласованный срок поставки",
    "penalty_mismatch": "Несогласованный размер неустойки",
    "total_sum_mismatch": "Цена договора не совпадает со спецификацией",
    "outdated_norm_reference": "Устаревшая ссылка на норму",
}
LEGAL_SECTIONS = {
    "1": "1. Предмет договора",
    "2": "2. Цена договора",
    "3": "3. Сроки поставки",
    "4": "4. Ответственность сторон",
    "5": "5. Применимые нормы",
    "spec": "Спецификация",
}


def legal_supply_contract(rng: random.Random) -> Generated:
    supplier, buyer = rng.choice(COMPANIES), rng.choice(BUYERS)
    signed = date(2026, rng.randint(9, 11), rng.randint(1, 28))
    number = f"{rng.randint(10, 99)}-П/{signed.year}"
    items = rng.sample(GOODS, 3)
    lines = [(name, unit, rng.randint(2, 12), price) for name, unit, price in items]
    total_spec = sum((_d(q) * _d(p) for _, _, q, p in lines), Decimal(0))
    delta = _d(rng.choice([1000, 2500, 4800, 9600]))
    total_contract = total_spec + delta
    days_spec = rng.choice([10, 15, 20])
    days_contract = days_spec + rng.choice([5, 10])
    pen_spec = rng.choice(["0,1", "0,2"])
    pen_contract = "0,5" if pen_spec == "0,1" else "1"
    clause_old, clause_new = "4.2", "5.1"
    reg = f"Регламент закупок {buyer}"

    contract = f"""# Договор поставки № {number}

г. Иркутск, {signed:%d.%m.%Y}

{supplier}, именуемое в дальнейшем «Поставщик», и {buyer}, именуемое в дальнейшем «Покупатель», заключили настоящий договор о нижеследующем.

## 1. Предмет договора
1.1. Поставщик обязуется передать Покупателю товар, а Покупатель — принять и оплатить его в количестве и по ценам, указанным в Спецификации (Приложение 1).

## 2. Цена договора
2.1. Цена договора составляет {_money(total_contract)} руб., включая НДС 20 %.
2.2. Оплата производится в течение 10 банковских дней после подписания товарной накладной.

## 3. Сроки поставки
3.1. Поставка осуществляется в течение {days_contract} рабочих дней с даты подписания договора.

## 4. Ответственность сторон
4.1. За просрочку поставки Поставщик уплачивает неустойку в размере {pen_contract} % от стоимости непоставленного товара за каждый день просрочки.

## 5. Применимые нормы
5.1. В части сроков приёмки товара стороны руководствуются п. {clause_old} {reg}.
"""
    rows = "\n".join(
        f"| {i} | {n} | {u} | {q} | {_money(_d(p))} | {_money(_d(q) * _d(p))} |"
        for i, (n, u, q, p) in enumerate(lines, 1)
    )
    spec_doc = f"""# Спецификация (Приложение 1 к договору № {number})

| № | Наименование | Ед. | Кол-во | Цена, руб. | Сумма, руб. |
|---|---|---|---|---|---|
{rows}

**Итого: {_money(total_spec)} руб., включая НДС 20 %.**

Срок поставки: {days_spec} рабочих дней с даты подписания договора.
Неустойка за просрочку поставки: {pen_spec} % от стоимости непоставленного товара за каждый день просрочки.
"""
    norm = f"""# Выдержка: {reg}

п. {clause_old}. Приёмка товара по количеству и качеству осуществляется в течение 5 рабочих дней с даты поставки.
п. 4.3. Претензии по качеству направляются поставщику в письменной форме.
"""
    docs = [
        Document(id="contract", title="Договор поставки", markdown=contract),
        Document(id="specification", title="Спецификация", markdown=spec_doc),
        Document(id="regulation", title="Регламент закупок (выдержка)", markdown=norm),
    ]
    key = [
        AnswerItem(
            id="d_total",
            section="2",
            defect_type="total_sum_mismatch",
            quote=f"Цена договора составляет {_money(total_contract)} руб.",
            expected_fix=f"Цена договора составляет {_money(total_spec)} руб., включая НДС 20 %.",
        ),
        AnswerItem(
            id="d_deadline",
            section="3",
            defect_type="deadline_mismatch",
            quote=f"в течение {days_contract} рабочих дней",
            expected_fix=f"Поставка осуществляется в течение {days_spec} рабочих дней с даты подписания договора.",
        ),
        AnswerItem(
            id="d_penalty",
            section="4",
            defect_type="penalty_mismatch",
            quote=f"в размере {pen_contract} %",
            expected_fix=f"Неустойка в размере {pen_spec} % от стоимости непоставленного товара за каждый день просрочки.",
        ),
    ]
    must = {"d_total": [_money(total_spec).split(",")[0]], "d_deadline": [str(days_spec)], "d_penalty": [pen_spec]}
    checks: list[Check] = []
    for k in key:
        checks.append(
            Check(
                id=f"find_{k.id}",
                title=f"Найдено несоответствие: {LEGAL_DEFECTS[k.defect_type].lower()}",
                type="rule_match",
                weight=20,
                critical=k.id == "d_total",
                params={"defect_type": k.defect_type, "section": k.section},
            )
        )
        checks.append(
            Check(
                id=f"fix_{k.id}",
                title="Предложена корректная редакция условия",
                type="semantic_similarity",
                weight=6,
                params={"defect_type": k.defect_type, "reference": k.expected_fix, "must_contain": must[k.id]},
            )
        )
    norm_item = AnswerItem(
        id="d_norm",
        section="5",
        defect_type="outdated_norm_reference",
        quote=f"п. {clause_old} {reg}",
        expected_fix=f"Стороны руководствуются п. {clause_new} {reg}.",
    )
    checks.append(
        Check(
            id="find_d_norm",
            title="Учтено изменение нормативной ссылки",
            type="rule_match",
            weight=14,
            params={"defect_type": "outdated_norm_reference", "section": "5", "requires_incident": "inc_norm"},
        )
    )
    incidents = [
        Incident(
            id="inc_norm",
            after_min=(2.0, 5.0),
            message=f"Юрист покупателя сообщает: вышла новая редакция регламента закупок, пункты перенумерованы — "
            f"порядок приёмки теперь в п. {clause_new}.",
            mutation=DocMutation(
                doc_id="regulation",
                find=f"п. {clause_old}. Приёмка",
                replace=f"_Редакция от {(signed + timedelta(days=3)):%d.%m.%Y}: пункты перенумерованы._\n\n"
                f"п. {clause_new}. Приёмка",
            ),
            adds_answer=norm_item.model_dump(),
        )
    ]
    form = {
        "type": "findings",
        "sections": LEGAL_SECTIONS,
        "fields": {
            "section": "Раздел",
            "defect_type": "Тип несоответствия",
            "comment": "Комментарий",
            "proposed_text": "Предлагаемая редакция",
        },
    }
    return Generated(
        docs, key, checks, incidents, form, LEGAL_DEFECTS, {"supplier": supplier, "buyer": buyer, "number": number}
    )


AUDIT_DOCS = {"invoice": "Счёт на оплату", "waybill": "Товарная накладная", "act": "Акт приёма-передачи"}


def audit_reconciliation(rng: random.Random) -> Generated:
    supplier, buyer = rng.choice(COMPANIES), rng.choice(BUYERS)
    d0 = date(2026, rng.randint(9, 11), rng.randint(1, 25))
    items = rng.sample(GOODS, 4)
    lines = [(n, u, rng.randint(1, 15), p) for n, u, p in items]
    correct_total = sum((_d(q) * _d(p) for _, _, q, p in lines), Decimal(0))
    bad_doc = rng.choice(list(AUDIT_DOCS))
    bad_line = rng.randrange(len(lines))
    err = _d(rng.choice([100, 900, 1000, 1800, 9000]))
    docs: list[Document] = []
    stated_bad_total = correct_total
    for doc_id, title in AUDIT_DOCS.items():
        rows, total = [], Decimal(0)
        for i, (n, u, q, p) in enumerate(lines):
            s = _d(q) * _d(p)
            if doc_id == bad_doc and i == bad_line:
                s = s + err
            total += s
            rows.append(f"| {i + 1} | {n} | {u} | {q} | {_money(_d(p))} | {_money(s)} |")
        if doc_id == bad_doc:
            stated_bad_total = total
        vat = (total * Decimal(20) / Decimal(120)).quantize(Decimal("0.01"), ROUND_HALF_UP)
        num = rng.randint(100, 999)
        docs.append(
            Document(
                id=doc_id,
                title=title,
                markdown=(
                    f"# {title} № {num} от {d0 + timedelta(days=len(docs)):%d.%m.%Y}\n\n"
                    f"Поставщик: {supplier}  \nПокупатель: {buyer}\n\n"
                    "| № | Наименование | Ед. | Кол-во | Цена, руб. | Сумма, руб. |\n|---|---|---|---|---|---|\n"
                    + "\n".join(rows)
                    + f"\n\n**Итого: {_money(total)} руб.**, в том числе НДС 20 %: {_money(vat)} руб.\n"
                ),
            )
        )
    discrepancy = stated_bad_total - correct_total
    key = [
        AnswerItem(id="doc", field="document_with_error", defect_type=bad_doc, quote=_money(stated_bad_total)),
        AnswerItem(id="sum", field="correct_sum", value=float(correct_total)),
        AnswerItem(id="diff", field="discrepancy", value=float(discrepancy)),
    ]
    bad_name = lines[bad_line][0]
    checks = [
        Check(
            id="error_document",
            title="Найден документ с ошибкой",
            type="rule_match",
            weight=40,
            critical=True,
            params={"field": "document_with_error", "expected": bad_doc},
        ),
        Check(
            id="correct_sum",
            title="Рассчитана правильная итоговая сумма",
            type="numeric_match",
            weight=30,
            critical=True,
            params={"field": "correct_sum", "expected": float(correct_total), "tolerance": 0.01},
        ),
        Check(
            id="discrepancy",
            title="Определена сумма расхождения",
            type="numeric_match",
            weight=20,
            params={"field": "discrepancy", "expected": float(discrepancy), "tolerance": 0.01, "abs": True},
        ),
        Check(
            id="explanation",
            title="Пояснена причина расхождения",
            type="semantic_similarity",
            weight=10,
            params={
                "field": "explanation",
                "reference": f"В документе «{AUDIT_DOCS[bad_doc]}» сумма по позиции «{bad_name}» не равна "
                f"произведению количества на цену, из-за чего итог завышен на {_money(discrepancy)} руб.",
                "must_contain": [bad_name.split()[0].lower()],
            },
        ),
    ]
    incidents = [
        Incident(
            id="inc_deadline",
            after_min=(3.0, 5.0),
            message="Главный бухгалтер просит закончить сверку быстрее: результат нужен до конца часа.",
        )
    ]
    form = {
        "type": "reconciliation",
        "documents": AUDIT_DOCS,
        "fields": {
            "document_with_error": "Документ с ошибкой",
            "correct_sum": "Правильная итоговая сумма, руб.",
            "discrepancy": "Сумма расхождения, руб.",
            "explanation": "Пояснение",
        },
    }
    return Generated(docs, key, checks, incidents, form, {}, {"supplier": supplier, "buyer": buyer})


GENERATORS = {"legal_supply_contract": legal_supply_contract, "audit_reconciliation": audit_reconciliation}


def reference_answer(answer_key: list[AnswerItem], checks: list[Check]) -> dict[str, Any]:
    """Ideal answer built from the key (used by dynamic validation)."""
    findings = [
        {"section": a.section, "defect_type": a.defect_type, "comment": "", "proposed_text": a.expected_fix}
        for a in answer_key
        if a.defect_type and not a.field
    ]
    values: dict[str, Any] = {}
    for a in answer_key:
        if a.field == "document_with_error":
            values[a.field] = a.defect_type
        elif a.field and a.value is not None:
            values[a.field] = a.value
    for c in checks:
        if c.type == "semantic_similarity" and c.params.get("field"):
            values[c.params["field"]] = c.params.get("reference", "")
    return {"findings": findings, **values}
