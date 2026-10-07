/** Подписи для клиентов: компания, а у частного лица — имя */
export const accountName = (client: { company: string; name: string } | null | undefined) => (client ? client.company || client.name : "");

/** «Имя, Компания» или просто имя, если клиент — частное лицо */
export const contactLine = (client: { company: string; name: string }) => (client.company ? `${client.name}, ${client.company}` : client.name);

export const isPerson = (client: { company: string }) => !client.company.trim();
