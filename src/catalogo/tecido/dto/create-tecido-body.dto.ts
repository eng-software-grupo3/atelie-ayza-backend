export class CreateTecidoBodyDto {
  [key: string]: unknown;
  nome!: string;
  preco_metro!: string | number;
  quantidade!: string | number;
}
