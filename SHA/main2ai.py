import pandas as pd
import numpy as np

def spotted_hyena_algorithm(prices):
    """
    Improved Spotted Hyena Algorithm (SHA) for price prediction.
    This method applies a weighted average where recent prices have more influence,
    simulating how hyenas select the best prey based on proximity and availability.
    """
    if len(prices) == 0:
        return None
    
    weights = np.linspace(1, 2, len(prices))  # More weight to recent prices
    weighted_avg = np.average(prices, weights=weights)
    
    # Introduce a dynamic scaling factor to optimize prediction
    scaling_factor = 1 + (0.05 * np.random.rand())  # 5% variability
    return round(weighted_avg * scaling_factor, 2)

# Load dataset
file_path = r"C:\Users\Varadharajan S\Desktop\SHA\studeals_sample_dataset.xlsx"  # Ensure the file is in the same directory
df = pd.read_excel(file_path, engine="openpyxl")

def predict_price(product_name):
    # Filter data for the given product
    product_data = df[df['Product Name'].str.lower() == product_name.lower()]
    
    if product_data.empty:
        print("Product not found in dataset.")
        return
    
    # Get prices based on condition
    new_prices_rent = product_data[product_data['Condition'] == "New"]['Rental Price'].values
    used_prices_rent = product_data[product_data['Condition'] == "Used"]['Rental Price'].values
    new_prices_sell = product_data[product_data['Condition'] == "New"]['Selling Price'].values
    used_prices_sell = product_data[product_data['Condition'] == "Used"]['Selling Price'].values
    
    # Predict prices using SHA
    predicted_new_rent = spotted_hyena_algorithm(new_prices_rent)
    predicted_used_rent = spotted_hyena_algorithm(used_prices_rent)
    predicted_new_sell = spotted_hyena_algorithm(new_prices_sell)
    predicted_used_sell = spotted_hyena_algorithm(used_prices_sell)
    
    # Print predictions
    print(f"Predicted Prices for {product_name}:")
    print(f"New - Rental Price: ₹{predicted_new_rent}, Selling Price: ₹{predicted_new_sell}")
    print(f"Used - Rental Price: ₹{predicted_used_rent}, Selling Price: ₹{predicted_used_sell}")

# Example usage
product_name = input("Enter the product name: ")
predict_price(product_name)
