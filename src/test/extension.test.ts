import * as assert from 'assert';
import { F2Link } from '../Items/F2Link';
import { F2YamlWorkspaceItem, LinkTypePreference, StandardItem, YamlNodeKind, YamlStringStyle } from '../Items/BasicItems';
import { ItemYamlHeaderType } from '../Items/ItemHeader';
import { ItemList } from '../Items/ItemList';
import { IdString } from '../Items/IdString';
import * as yaml from 'yaml';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('Parses all F2Links from the specification links section', () => {
		const links = [
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..<Task>(0).LinkToThis1<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..MyTask(0).LinkToThis1<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList.."My Task".LinkToThis1<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..<NonStandardItem>(0).LinkToThis2<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..<NonStandardItem>(0).LinkToThis2<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..<NonStandardItem>(0).LinkToThis2<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..MyTask(1).LinkToThis3<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..MyTask(1).LinkToThis3<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..MyTask(1).LinkToThis3<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..<NonStandardItem>(1).LinkToThis4<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..<NonStandardItem>(1).LinkToThis4<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..<NonStandardItem>(1).LinkToThis4<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList2..<Task>.LinkToThis5<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList2..MyTask.LinkToThis5<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList2.."My Task".LinkToThis5<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList2..<NonStandardItem>.LinkToThis6<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList2..<NonStandardItem>.LinkToThis6<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList2..<NonStandardItem>.LinkToThis6<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyNonStandardItemList..<NonStandardItem>(0).LinkToThis7<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyNonStandardItemList..<NonStandardItem>(0).LinkToThis7<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyNonStandardItemList..<NonStandardItem>(0).LinkToThis7<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty..<Task>.LinkToThis9<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty..MyTask.LinkToThis9<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty.."My Task".LinkToThis9<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty2..LinkToThis10<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty2..MyTask.LinkToThis10<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty2.."My Task".LinkToThis10<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty3..MyTask.LinkToThis11<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty3..MyTask.LinkToThis11<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty3.."My Task".LinkToThis11<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty4..LinkToThis12<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty4..LinkToThis12<',
			'-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty4..LinkToThis12<'
		];

		for (const link of links) {
			assert.doesNotThrow(() => F2Link.ParseFromStringArray([link]), link);
		}
	});

	test('GetF2Link generates links complying with the specification', () => {
		class TestStandardItem extends StandardItem {}

		const createStandardItem = (
			headerType: ItemYamlHeaderType,
			id?: string,
			summary?: string,
			typeId?: string
		): TestStandardItem => {
			const item = new TestStandardItem();
			item.YamlRepresentation.HeaderType = headerType;
			if (id !== undefined)
				item.Id = IdString.ParseFromString(id);
			if (summary !== undefined)
				item.Summary = summary;
			if (typeId !== undefined)
				item.TypeId = IdString.ParseFromString(typeId);
			return item;
		};

		const createNonStandardItem = (typeId: string): F2YamlWorkspaceItem => {
			const item = new F2YamlWorkspaceItem();
			item.TypeId = IdString.ParseFromString(typeId);
			return item;
		};

		const root = createStandardItem(ItemYamlHeaderType.Id, 'MyItem', undefined, 'Container');
		root.YamlRepresentation.WorkspaceRelativePath = 'CurrentWork\\Bobi\\Test';

		const myItemList = new ItemList<F2YamlWorkspaceItem>(root, IdString.ParseFromString('MyItemList'));
		root.SetPropertyValue(IdString.ParseFromString('MyItemList'), myItemList);

		const linkToThis1Owner = createStandardItem(ItemYamlHeaderType.TypeId, 'MyTask', 'My Task', 'Task');
		myItemList.Add(linkToThis1Owner);
		const linkToThis1 = createNonStandardItem('PropertyOwner');
		linkToThis1.SetParentItemAndProperty(linkToThis1Owner, IdString.ParseFromString('LinkToThis1'));

		const linkToThis2Owner = createNonStandardItem('NonStandardItem');
		myItemList.Add(linkToThis2Owner);
		const linkToThis2 = createNonStandardItem('PropertyOwner');
		linkToThis2.SetParentItemAndProperty(linkToThis2Owner, IdString.ParseFromString('LinkToThis2'));

		const linkToThis3Owner = createStandardItem(ItemYamlHeaderType.Id, 'MyTask', undefined, 'Task');
		myItemList.Add(linkToThis3Owner);
		const linkToThis3 = createNonStandardItem('PropertyOwner');
		linkToThis3.SetParentItemAndProperty(linkToThis3Owner, IdString.ParseFromString('LinkToThis3'));

		const linkToThis4Owner = createNonStandardItem('NonStandardItem');
		myItemList.Add(linkToThis4Owner);
		const linkToThis4 = createNonStandardItem('PropertyOwner');
		linkToThis4.SetParentItemAndProperty(linkToThis4Owner, IdString.ParseFromString('LinkToThis4'));

		const myItemList2 = new ItemList<F2YamlWorkspaceItem>(root, IdString.ParseFromString('MyItemList2'));
    root.SetPropertyValue(IdString.ParseFromString('MyItemList2'), myItemList2);

		const linkToThis5Owner = createStandardItem(ItemYamlHeaderType.TypeId, 'MyTask', 'My Task', 'Task');
		myItemList2.Add(linkToThis5Owner);
		const linkToThis5 = createNonStandardItem('PropertyOwner');
		linkToThis5.SetParentItemAndProperty(linkToThis5Owner, IdString.ParseFromString('LinkToThis5'));

		const linkToThis6Owner = createNonStandardItem('NonStandardItem');
		myItemList2.Add(linkToThis6Owner);
		const linkToThis6 = createNonStandardItem('PropertyOwner');
		linkToThis6.SetParentItemAndProperty(linkToThis6Owner, IdString.ParseFromString('LinkToThis6'));

		const myNonStandardItemList = new ItemList<F2YamlWorkspaceItem>(root, IdString.ParseFromString('MyNonStandardItemList'));
    root.SetPropertyValue(IdString.ParseFromString('MyNonStandardItemList'), myNonStandardItemList);

		const linkToThis7Owner = createNonStandardItem('NonStandardItem');
		myNonStandardItemList.Add(linkToThis7Owner);
		const duplicateNonStandard = createNonStandardItem('NonStandardItem');
		myNonStandardItemList.Add(duplicateNonStandard);
		const linkToThis7 = createNonStandardItem('PropertyOwner');
		linkToThis7.SetParentItemAndProperty(linkToThis7Owner, IdString.ParseFromString('LinkToThis7'));

		const linkToThis9Owner = createStandardItem(ItemYamlHeaderType.TypeId, 'MyTask', 'My Task', 'Task');
    root.SetPropertyValue(IdString.ParseFromString('MyItemProperty'), linkToThis9Owner);
		linkToThis9Owner.SetParentItemAndProperty(root, IdString.ParseFromString('MyItemProperty'));
		const linkToThis9 = createNonStandardItem('PropertyOwner');
		linkToThis9.SetParentItemAndProperty(linkToThis9Owner, IdString.ParseFromString('LinkToThis9'));

		const linkToThis10Owner = createStandardItem(ItemYamlHeaderType.None, 'MyTask', 'My Task', 'Task');
    root.SetPropertyValue(IdString.ParseFromString('MyItemProperty2'), linkToThis10Owner);
		linkToThis10Owner.SetParentItemAndProperty(root, IdString.ParseFromString('MyItemProperty2'));
		const linkToThis10 = createNonStandardItem('PropertyOwner');
		linkToThis10.SetParentItemAndProperty(linkToThis10Owner, IdString.ParseFromString('LinkToThis10'));

		const linkToThis11Owner = createStandardItem(ItemYamlHeaderType.Id, 'MyTask', 'My Task', 'Task');
    root.SetPropertyValue(IdString.ParseFromString('MyItemProperty3'), linkToThis11Owner);
		linkToThis11Owner.SetParentItemAndProperty(root, IdString.ParseFromString('MyItemProperty3'));
		const linkToThis11 = createNonStandardItem('PropertyOwner');
		linkToThis11.SetParentItemAndProperty(linkToThis11Owner, IdString.ParseFromString('LinkToThis11'));

		const linkToThis12Owner = createNonStandardItem('NonStandardItem');
    root.SetPropertyValue(IdString.ParseFromString('MyItemProperty4'), linkToThis12Owner);
		linkToThis12Owner.SetParentItemAndProperty(root, IdString.ParseFromString('MyItemProperty4'));
		const linkToThis12 = createNonStandardItem('PropertyOwner');
		linkToThis12.SetParentItemAndProperty(linkToThis12Owner, IdString.ParseFromString('LinkToThis12'));

		const expectedLinks = [
			[linkToThis1, LinkTypePreference.None, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..<Task>(0).LinkToThis1<'],
			[linkToThis1, LinkTypePreference.Id, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..MyTask(0).LinkToThis1<'],
			[linkToThis1, LinkTypePreference.Summary, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList.."My Task".LinkToThis1<'],
			[linkToThis2, LinkTypePreference.None, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..<NonStandardItem>(0).LinkToThis2<'],
			[linkToThis2, LinkTypePreference.Id, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..<NonStandardItem>(0).LinkToThis2<'],
			[linkToThis2, LinkTypePreference.Summary, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..<NonStandardItem>(0).LinkToThis2<'],
			[linkToThis3, LinkTypePreference.None, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..MyTask(1).LinkToThis3<'],
			[linkToThis3, LinkTypePreference.Id, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..MyTask(1).LinkToThis3<'],
			[linkToThis3, LinkTypePreference.Summary, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..MyTask(1).LinkToThis3<'],
			[linkToThis4, LinkTypePreference.None, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..<NonStandardItem>(1).LinkToThis4<'],
			[linkToThis4, LinkTypePreference.Id, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..<NonStandardItem>(1).LinkToThis4<'],
			[linkToThis4, LinkTypePreference.Summary, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList..<NonStandardItem>(1).LinkToThis4<'],
			[linkToThis5, LinkTypePreference.None, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList2..<Task>.LinkToThis5<'],
			[linkToThis5, LinkTypePreference.Id, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList2..MyTask.LinkToThis5<'],
			[linkToThis5, LinkTypePreference.Summary, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList2.."My Task".LinkToThis5<'],
			[linkToThis6, LinkTypePreference.None, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList2..<NonStandardItem>.LinkToThis6<'],
			[linkToThis6, LinkTypePreference.Id, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList2..<NonStandardItem>.LinkToThis6<'],
			[linkToThis6, LinkTypePreference.Summary, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemList2..<NonStandardItem>.LinkToThis6<'],
			[linkToThis7, LinkTypePreference.None, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyNonStandardItemList..<NonStandardItem>(0).LinkToThis7<'],
			[linkToThis7, LinkTypePreference.Id, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyNonStandardItemList..<NonStandardItem>(0).LinkToThis7<'],
			[linkToThis7, LinkTypePreference.Summary, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyNonStandardItemList..<NonStandardItem>(0).LinkToThis7<'],
			[linkToThis9, LinkTypePreference.None, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty..<Task>.LinkToThis9<'],
			[linkToThis9, LinkTypePreference.Id, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty..MyTask.LinkToThis9<'],
			[linkToThis9, LinkTypePreference.Summary, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty.."My Task".LinkToThis9<'],
			[linkToThis10, LinkTypePreference.None, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty2..LinkToThis10<'],
			[linkToThis10, LinkTypePreference.Id, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty2..MyTask.LinkToThis10<'],
			[linkToThis10, LinkTypePreference.Summary, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty2.."My Task".LinkToThis10<'],
			[linkToThis11, LinkTypePreference.None, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty3..MyTask.LinkToThis11<'],
			[linkToThis11, LinkTypePreference.Id, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty3..MyTask.LinkToThis11<'],
			[linkToThis11, LinkTypePreference.Summary, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty3.."My Task".LinkToThis11<'],
			[linkToThis12, LinkTypePreference.None, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty4..LinkToThis12<'],
			[linkToThis12, LinkTypePreference.Id, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty4..LinkToThis12<'],
			[linkToThis12, LinkTypePreference.Summary, '-->CurrentWork\\Bobi\\Test\\..MyItem.MyItemProperty4..LinkToThis12<']
		] as const;

		for (const [item, preference, expected] of expectedLinks)
			assert.strictEqual(item.GetF2Link(preference).toString(), expected);
	});

	test('Stores further yaml representation information', () => {
		class TestStandardItemForYamlRepresentation extends StandardItem {}

		const parsed = yaml.parseDocument(`
Done .My task:
  +: {CreatedBy: Bobi, CreatedAt: 20260622}
  Description: |
    Line1
    Line2
  Tags: [CSV, Extension]
  Notes:
    Detail: value
`);

		const rootPair = parsed.contents instanceof yaml.YAMLMap
			? parsed.contents.items[0] as yaml.Pair<yaml.Scalar, yaml.Node>
			: undefined;

		assert.ok(rootPair !== undefined);
		const item = new TestStandardItemForYamlRepresentation().ImportFromYamlScalarMapPair(rootPair as yaml.Pair<yaml.Scalar, yaml.YAMLMap>);

		assert.strictEqual(item.YamlRepresentation.IsMapFlowStyle, false);
		assert.deepStrictEqual(item.YamlRepresentation.AdditionalPropertiesPropertyIds.map((id: IdString) => id.Value), ['CreatedBy', 'CreatedAt']);

		const descriptionRendering = item.YamlRepresentation.PropertyRenderingById.get('Description');
		assert.ok(descriptionRendering);
		assert.strictEqual(descriptionRendering?.NodeKind, YamlNodeKind.Scalar);
		assert.strictEqual(descriptionRendering?.StringStyle, YamlStringStyle.BlockLiteral);

		const tagsRendering = item.YamlRepresentation.PropertyRenderingById.get('Tags');
		assert.ok(tagsRendering);
		assert.strictEqual(tagsRendering?.NodeKind, YamlNodeKind.Sequence);
		assert.strictEqual(tagsRendering?.IsFlowStyle, true);

		const notesRendering = item.YamlRepresentation.PropertyRenderingById.get('Notes');
		assert.ok(notesRendering);
		assert.strictEqual(notesRendering?.NodeKind, YamlNodeKind.Mapping);
		assert.strictEqual(notesRendering?.IsFlowStyle, false);

		const createdByRendering = item.YamlRepresentation.PropertyRenderingById.get('CreatedBy');
		assert.ok(createdByRendering);
		assert.strictEqual(createdByRendering?.NodeKind, YamlNodeKind.Scalar);
		assert.strictEqual(createdByRendering?.StringStyle, YamlStringStyle.Plain);
	});
});
