import uuid
from api.models import Client, Supplier, Product

def execute_import(company, data_type, normalized_rows):
    """
    Takes the cleaned, mapped rows and inserts them into the actual database models.
    """
    organisation = company
    created_count = 0
    errors = []

    for i, row in enumerate(normalized_rows):
        try:
            if data_type == 'clients':
                # Map row fields to Client fields. Defaults if missing.
                company_name = row.get('company_name') or row.get('contact_name') or 'Unknown Client'
                customer_code = row.get('customer_code') or f"CUST-{uuid.uuid4().hex[:8].upper()}"
                
                Client.objects.create(
                    organisation=organisation,
                    customer_code=customer_code,
                    company_name=company_name,
                    contact_name=row.get('contact_name', ''),
                    email=row.get('email', ''),
                    phone=row.get('phone', ''),
                    mobile=row.get('mobile', ''),
                    website=row.get('website', ''),
                    tax_identifier=row.get('tax_identifier', ''),
                    ice=row.get('ice', ''),
                    rc=row.get('rc', ''),
                    address=row.get('address', ''),
                    city=row.get('city', ''),
                    postal_code=row.get('postal_code', ''),
                    country=row.get('country', ''),
                    credit_limit=row.get('credit_limit') or 0,
                    notes=row.get('notes', ''),
                )
                created_count += 1
            
            elif data_type == 'suppliers':
                company_name = row.get('company_name') or row.get('contact_name') or 'Unknown Supplier'
                supplier_code = row.get('supplier_code') or f"SUPP-{uuid.uuid4().hex[:8].upper()}"
                
                Supplier.objects.create(
                    organisation=organisation,
                    supplier_code=supplier_code,
                    company_name=company_name,
                    contact_name=row.get('contact_name', ''),
                    email=row.get('email', ''),
                    phone=row.get('phone', ''),
                    mobile=row.get('mobile', ''),
                    website=row.get('website', ''),
                    tax_identifier=row.get('tax_identifier', ''),
                    ice=row.get('ice', ''),
                    rc=row.get('rc', ''),
                    address=row.get('address', ''),
                    city=row.get('city', ''),
                    postal_code=row.get('postal_code', ''),
                    country=row.get('country', ''),
                    notes=row.get('notes', ''),
                )
                created_count += 1

            elif data_type in ['inventory', 'products', 'stock']:
                # For stock management / products
                name = row.get('name') or row.get('product_name') or 'Unknown Product'
                sku = row.get('sku') or row.get('variant_name') or f"SKU-{uuid.uuid4().hex[:8].upper()}"
                
                # Convert numeric fields safely
                quantity = row.get('quantity') or row.get('stock_quantity') or row.get('available_quantity') or 0
                try:
                    quantity = float(quantity)
                except (ValueError, TypeError):
                    quantity = 0

                try:
                    selling_price = float(row.get('selling_price') or 0)
                except (ValueError, TypeError):
                    selling_price = 0
                    
                # Handle active status
                status_val = str(row.get('status') or '').lower()
                is_active = True
                if status_val in ['inactif', 'inactive', 'out of stock', 'rupture', 'non']:
                    is_active = False

                from api.models import Inventory, Category, Supplier, SupplierProduct

                # Get or create category if provided
                category_obj = None
                category_name = row.get('category_name')
                if category_name:
                    category_obj, _ = Category.objects.get_or_create(
                        organisation=organisation,
                        name=str(category_name).strip()
                    )

                product = Product.objects.create(
                    organisation=organisation,
                    name=name,
                    description=row.get('description', ''),
                    category=category_obj,
                    sku=sku,
                    barcode=row.get('barcode', ''),
                    brand=row.get('brand', ''),
                    unit=row.get('unit', ''),
                    selling_price=selling_price,
                    is_active=is_active,
                    track_inventory=True,
                )

                # Map supplier if provided
                supplier_name = row.get('supplier_name')
                if supplier_name:
                    supplier_obj, _ = Supplier.objects.get_or_create(
                        organisation=organisation,
                        company_name=str(supplier_name).strip()
                    )
                    SupplierProduct.objects.create(
                        supplier=supplier_obj,
                        product=product
                    )
                
                Inventory.objects.create(
                    product=product,
                    quantity=quantity,
                    available_quantity=quantity,
                )
                created_count += 1

            else:
                errors.append(f"Row {i}: Unsupported data type '{data_type}'")
                break
                
        except Exception as e:
            errors.append(f"Row {i} Error: {str(e)}")

    return {
        "status": "success" if not errors else "partial_success",
        "created_count": created_count,
        "errors": errors
    }
