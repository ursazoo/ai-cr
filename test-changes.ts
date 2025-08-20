// 测试文件 - 用于验证智能上下文扩展器
export interface TestInterface {
  id: string;
  name: string;
}

export function testFunction(param: TestInterface): string {
  console.log('这是一个测试函数'); // TODO: 移除调试日志
  return `Hello, ${param.name}!`;
}

export class TestClass {
  private value: string;

  constructor(value: string) {
    this.value = value;
  }

  public getValue(): string {
    return this.value;
  }
}